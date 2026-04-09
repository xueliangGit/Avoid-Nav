'use client';

import { useEffect, useRef } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import rawData from '../../lib/refined-data.json';
import { spatialIndex } from '../../lib/index';
import { rdp } from '../../lib/utils/rdp';

const MapContainer = () => {
  const mapRef = useRef<any>(null);
  const drivingRef = useRef<any>(null);
  const initialDrivingRef = useRef<any>(null);
  const userLocationRef = useRef<any>(null);

  useEffect(() => {
    // 初始化空间索引数据（确保点击前已加载完数据）
    if (rawData.points && Array.isArray(rawData.points)) {
      spatialIndex.load(rawData.points);
    }

    // 高德地图安全密钥配置
    (window as any)._AMapSecurityConfig = {
      securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE,
    };

    AMapLoader.load({
      key: process.env.NEXT_PUBLIC_AMAP_KEY!, // 高德地图 Key
      version: '2.0',
      plugins: ['AMap.LabelsLayer', 'AMap.Geolocation', 'AMap.Driving'],
    }).then((AMap) => {
      // 初始化地图
      const map = new AMap.Map('container', {
        zoom: 11,
        center: [116.397428, 39.90923], // 北京中心
      });
      mapRef.current = map;

      // 1. 初始化 LabelsLayer
      const labelsLayer = new AMap.LabelsLayer({
        zooms: [3, 20],
        zIndex: 1000,
        collision: false, // 允许碰撞，展示所有风险点
      });
      map.add(labelsLayer);

      // 2. 映射风险等级对应的图标 URL
      const iconMap: Record<number, string> = {
        3: 'https://a.amap.com/jsapi_demos/static/demo-center/marker/marker-red.png',    // 红
        2: 'https://a.amap.com/jsapi_demos/static/demo-center/marker/marker-blue.png',   // 蓝
        1: 'https://a.amap.com/jsapi_demos/static/demo-center/marker/marker-orange.png', // 橙
      };
      const defaultIcon = 'https://a.amap.com/jsapi_demos/static/demo-center/marker/marker-violet.png'; // 紫

      // 3. 准备点位数据并添加到图层
      const markers = rawData.points.map((point: any) => {
        const [lng, lat, type, risk] = point;
        const iconUrl = iconMap[risk] || defaultIcon;

        return new AMap.LabelMarker({
          name: type,
          position: [lng, lat],
          zIndex: risk,
          icon: {
            type: 'image',
            image: iconUrl,
            size: [25, 34],
            anchor: 'bottom-center',
          },
        });
      });

      labelsLayer.add(markers);

      // 4. 集成 Geolocation 插件获取当前位置
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true, // 是否使用高精度定位
        timeout: 10000,           // 超过10秒后停止定位
        buttonPosition: 'RB',     // 定位按钮的停靠位置
        buttonOffset: [10, 20],   // 定位按钮与设置的停靠位置的偏移量
        zoomToAccuracy: true,     // 定位成功后是否自动调整地图视野到定位点
      });

      map.addControl(geolocation);
      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete') {
          console.log('定位成功', result);
          userLocationRef.current = [result.position.lng, result.position.lat];
        } else {
          console.warn('定位失败，使用默认中心点');
          userLocationRef.current = [116.397428, 39.90923];
        }
      });

      // 5. 监听地图点击事件以设置终点并发起请求
      map.on('click', (e: any) => {
        if (!userLocationRef.current) {
          alert('正在获取定位中，请稍候再试。');
          return;
        }

        const start = userLocationRef.current;
        const end = [e.lnglat.lng, e.lnglat.lat];

        // 清除地图上旧的路线
        if (drivingRef.current) drivingRef.current.clear();
        if (initialDrivingRef.current) initialDrivingRef.current.clear();

        // 步骤A：第一次路径规划（不绑定map实例，仅为了获取基础路线数据进行分析）
        initialDrivingRef.current = new AMap.Driving({
          policy: AMap.DrivingPolicy.LEAST_TIME,
        });

        initialDrivingRef.current.search(
          new AMap.LngLat(start[0], start[1]),
          new AMap.LngLat(end[0], end[1]),
          (status: string, result: any) => {
            if (status === 'complete' && result.routes && result.routes.length > 0) {
              const route = result.routes[0];
              const pathPoints: { lng: number; lat: number }[] = [];

              // 收集路线中的所有经纬度点集
              route.steps.forEach((step: any) => {
                step.path.forEach((p: any) => {
                  pathPoints.push({ lng: p.lng, lat: p.lat });
                });
              });

              // 步骤B：对路径点集进行 RDP 抽稀简化（epsilon = 0.001）
              const simplifiedPath = rdp(pathPoints, 0.001);

              // 步骤C：通过 R-Tree 在简化后的路径关键点周边（半径 0.5km = 500m）检索风险点
              const riskPointsMap = new Map<string, any>();
              simplifiedPath.forEach((p) => {
                const risks = spatialIndex.search(p.lng, p.lat, 0.5);
                risks.forEach((r: any) => {
                  const key = `${r.lng},${r.lat}`;
                  if (!riskPointsMap.has(key)) {
                    riskPointsMap.set(key, r);
                  }
                });
              });

              // 步骤D：过滤唯一的风险点，根据风险等级(risk 3)降序排序，并截取前 100 个
              let uniqueRiskPoints = Array.from(riskPointsMap.values());
              uniqueRiskPoints.sort((a, b) => b.risk - a.risk); // 风险最高的排前面
              if (uniqueRiskPoints.length > 100) {
                uniqueRiskPoints = uniqueRiskPoints.slice(0, 100);
              }

              // 步骤E：将风险点转换为 avoidpolygons（根据坐标构造微小多边形区块）
              // 偏移量 0.0005 约相当于边长百米的矩形区域
              const offset = 0.0005;
              const avoidpolygons = uniqueRiskPoints.map((r) => [
                [r.lng - offset, r.lat - offset],
                [r.lng + offset, r.lat - offset],
                [r.lng + offset, r.lat + offset],
                [r.lng - offset, r.lat + offset],
              ]);

              // 步骤F：使用包含避让区域的参数重新发起导航请求（绑定 map 实例以便直接渲染）
              drivingRef.current = new AMap.Driving({
                map: map,
                policy: AMap.DrivingPolicy.LEAST_TIME,
              });

              if (avoidpolygons.length > 0) {
                drivingRef.current.setAvoidPolygons(avoidpolygons);
              }

              drivingRef.current.search(
                new AMap.LngLat(start[0], start[1]),
                new AMap.LngLat(end[0], end[1]),
                (finalStatus: string, finalResult: any) => {
                  if (finalStatus === 'complete') {
                    console.log('基于风险规避区域的路线规划成功', finalResult);
                  } else {
                    console.error('基于风险规避区域的路线规划失败', finalResult);
                  }
                }
              );
            } else {
              console.error('初始路线获取失败，无法进行路径规划', result);
            }
          }
        );
      });

    }).catch((e) => {
      console.error('地图加载失败:', e);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
      }
    };
  }, []);

  return (
    <div 
      id="container" 
      style={{ 
        width: '100%', 
        height: '100%', 
        backgroundColor: '#f0f0f0' 
      }} 
    />
  );
};

export default MapContainer;
