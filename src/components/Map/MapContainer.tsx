'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import rawData from '../../lib/refined-data.json';
import { spatialIndex } from '../../lib/index';
import { Navigation, X, Search, LocateFixed, ShieldCheck, ShieldAlert, Loader2, Terminal } from 'lucide-react';

interface DebugLog { round: number; message: string; type: 'info' | 'success' | 'warn' | 'ignore'; timestamp: string; }
interface RouteRisk { id: string; lng: number; lat: number; name: string; risk: number; aa: string; direction?: string; }

const MapContainer = () => {
  // --- 声明所有必要的 Refs ---
  const mapRef = useRef<any>(null);
  const drivingRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null); // 刚才漏掉的这一行
  const userLocationRef = useRef<any>(null);
  const polygonOverlaysRef = useRef<any[]>([]); 
  const riskMarkersRef = useRef<any[]>([]);
  const debugEndRef = useRef<HTMLDivElement>(null);

  // --- 声明所有必要的 States ---
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [endPoint, setEndPoint] = useState<[number, number] | null>(null);
  const [startName, setStartName] = useState('');
  const [endName, setEndName] = useState('');
  const [routeRisks, setRouteRisks] = useState<RouteRisk[]>([]);
  const [masterAvoidList, setMasterAvoidList] = useState<Map<string, RouteRisk>>(new Map());
  const [userIgnoredIds, setUserIgnoredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [planningStatus, setPlanningStatus] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);

  // --- 安全校验与辅助工具 ---
  const isSafeNum = (val: any): val is number => typeof val === 'number' && !isNaN(val);
  const getSafeLngLat = (lng: any, lat: any): any => {
    const lo = parseFloat(lng); const la = parseFloat(lat);
    if (isSafeNum(lo) && isSafeNum(la)) return { lng: lo, lat: la };
    return null;
  };
  const fix = (n: number) => isSafeNum(n) ? parseFloat(n.toFixed(6)) : 0;

  const addLog = (round: number, message: string, type: DebugLog['type'] = 'info') => {
    setDebugLogs(prev => [...prev, { round, message, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  useEffect(() => { debugEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [debugLogs]);

  // 方向判定
  const getDirAngle = (dirStr: string): number | null => {
    if (dirStr.includes('西向东')) return 0;
    if (dirStr.includes('南向北')) return 90;
    if (dirStr.includes('东向西')) return 180;
    if (dirStr.includes('北向南')) return 270;
    return null;
  };

  const isDirectionConflict = (carAngle: number, dirStr?: string): { conflict: boolean, car: number, target: number | null, reason: string } => {
    const carA = Math.round(carAngle);
    if (!dirStr || dirStr.includes('双向')) return { conflict: true, car: carA, target: null, reason: '双向' };
    const targetA = getDirAngle(dirStr);
    if (targetA === null) return { conflict: true, car: carA, target: null, reason: '未识别方向' };
    const diff = Math.abs(carA - targetA);
    const normalizedDiff = Math.min(diff, 360 - diff);
    return { conflict: normalizedDiff <= 75, car: carA, target: targetA, reason: dirStr };
  };

  // 初始化地图
  useEffect(() => {
    if (rawData.points) spatialIndex.load(rawData.points);
    (window as any)._AMapSecurityConfig = { securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE };
    
    AMapLoader.load({
      key: process.env.NEXT_PUBLIC_AMAP_KEY!,
      version: '2.0',
      plugins: ['AMap.LabelsLayer', 'AMap.Geolocation', 'AMap.Driving', 'AMap.InfoWindow', 'AMap.AutoComplete', 'AMap.PlaceSearch', 'AMap.Polygon'],
    }).then((AMap) => {
      const map = new AMap.Map('container', { zoom: 11, center: [116.397428, 39.90923], mapStyle: 'amap://styles/dark' });
      mapRef.current = map;
      
      const infoWindow = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -30) });
      infoWindowRef.current = infoWindow;

      const labelsLayer = new AMap.LabelsLayer({ zooms: [3, 20], zIndex: 1000, collision: false });
      map.add(labelsLayer);

      const markers = rawData.points.map((p: any) => {
        const safe = getSafeLngLat(p[0], p[1]);
        if (!safe) return null;
        const labelMarker = new AMap.LabelMarker({ 
          name: p[5] || '', position: [safe.lng, safe.lat], zIndex: p[3] || 1, 
          extData: { name: p[5], aa: p[2], risk: p[3], href: p[4] },
          icon: { type: 'image', image: `/images/${p[2] || 1}.png`, size: [20, 25], anchor: 'bottom-center' } 
        });

        labelMarker.on('click', (e: any) => {
          const data = e.target.getExtData();
          infoWindow.setContent(`
            <div style="padding: 12px; min-width: 200px; font-family: sans-serif; color: #1e293b;">
              <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 800;">${data.name}</h4>
              <a href="https://www.jinjing365.com/wap/${data.href}" target="_blank" style="display: block; width: 100%; text-align: center; background: #2563eb; color: white; padding: 8px; border-radius: 8px; font-size: 12px; text-decoration: none; font-weight: bold;">查看详细报告 ↗</a>
            </div>
          `);
          infoWindow.open(map, e.target.getPosition());
        });
        return labelMarker;
      }).filter(Boolean);
      labelsLayer.add(markers);

      const autoStart = new AMap.AutoComplete({ input: 'start-input' });
      const autoEnd = new AMap.AutoComplete({ input: 'end-input' });
      autoStart.on('select', (e: any) => { if(e.poi?.location) { setStartPoint([e.poi.location.lng, e.poi.location.lat]); setStartName(e.poi.name); map.setCenter(e.poi.location); } });
      autoEnd.on('select', (e: any) => { if(e.poi?.location) { setEndPoint([e.poi.location.lng, e.poi.location.lat]); setEndName(e.poi.name); map.setCenter(e.poi.location); } });

      const geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 10000, buttonPosition: 'RB' });
      map.addControl(geolocation);
      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete' && result.position) {
          const pos: [number, number] = [result.position.lng, result.position.lat];
          userLocationRef.current = pos; setStartPoint(pos); setStartName('我的位置');
        }
        setLoading(false);
      });
    }).catch(e => console.error('API Error:', e));
  }, []);

  const scanPathRisks = (pathPoints: any[], round: number) => {
    const riskMap = new Map<string, RouteRisk>();
    let ignored = 0;
    for (let i = 0; i < pathPoints.length - 1; i += 2) {
      const p1 = pathPoints[i], p2 = pathPoints[i+1];
      const carAngle = (Math.atan2(p2.lat - p1.lat, p2.lng - p1.lng) * 180 / Math.PI + 360) % 360;
      spatialIndex.search(p1.lng, p1.lat, 0.08).forEach((r: any) => {
        const { conflict, car, target } = isDirectionConflict(carAngle, r.direction);
        if (conflict) {
          riskMap.set(`${r.lng},${r.lat}`, { id: `${r.lng},${r.lat}`, lng: r.lng, lat: r.lat, name: r.name, risk: r.risk, aa: r.aa, direction: r.direction });
        } else {
          ignored++;
          if (ignored % 100 === 0) addLog(round, `[安全忽略] ${r.name} (行驶 ${car}° vs 监控 ${target}°)`, 'ignore');
        }
      });
    }
    return riskMap;
  };

  const planRoute = useCallback(async (isManualTrigger: boolean = false) => {
    if (!startPoint || !endPoint || !mapRef.current) return;
    const AMap = (window as any).AMap;
    if (!isManualTrigger) { setDebugLogs([]); addLog(0, "启动全自动规避引擎...", "info"); }
    
    polygonOverlaysRef.current.forEach(p => p.setMap(null));
    riskMarkersRef.current.forEach(m => m.setMap(null));

    const fetchRoute = (polygons: any[] = []): Promise<any[]> => {
      return new Promise((resolve) => {
        const d = new AMap.Driving({ policy: AMap.DrivingPolicy.LEAST_TIME });
        if (polygons.length > 0) d.setAvoidPolygons(polygons);
        const sCoord = getSafeLngLat(startPoint[0], startPoint[1]);
        const eCoord = getSafeLngLat(endPoint[0], endPoint[1]);
        if (!sCoord || !eCoord) return resolve([]);
        d.search(new AMap.LngLat(sCoord.lng, sCoord.lat), new AMap.LngLat(eCoord.lng, eCoord.lat), (s:string, r:any) => {
          const pts: any[] = [];
          if (s === 'complete' && r.routes?.[0]) r.routes[0].steps.forEach((step: any) => step.path.forEach((p: any) => pts.push({ lng: p.lng, lat: p.lat })));
          resolve(pts);
        });
      });
    };

    let currentMasterList = new Map<string, RouteRisk>();
    const MAX_ROUNDS = 5;

    for (let i = 0; i < MAX_ROUNDS; i++) {
      setPlanningStatus(`Round ${i+1}`);
      if (i > 0) await new Promise(res => setTimeout(res, 1200));

      const activePolygons = Array.from(currentMasterList.values())
        .filter(r => !userIgnoredIds.has(r.id))
        .slice(0, 40)
        .map(r => { 
          const o = 0.001; 
          const lo = fix(r.lng); const la = fix(r.lat);
          return [[lo-o, la-o], [lo+o, la-o], [lo+o, la+o], [lo-o, la+o]]; 
        });

      const points = await fetchRoute(activePolygons);
      if (points.length === 0) break;

      const roundRisks = scanPathRisks(points, i+1);
      let foundNew = false;
      roundRisks.forEach((v, k) => { if (!currentMasterList.has(k)) { currentMasterList.set(k, v); foundNew = true; addLog(i+1, `[发现风险] ${v.name}`, "success"); } });

      if (!foundNew) { addLog(i+1, "路径已安全规避", "success"); break; }
    }

    setMasterAvoidList(new Map(currentMasterList));
    setPlanningStatus("Finalizing...");

    if (drivingRef.current) drivingRef.current.clear();
    drivingRef.current = new AMap.Driving({ map: mapRef.current, policy: AMap.DrivingPolicy.LEAST_TIME });
    const finalPolygons = Array.from(currentMasterList.values())
      .filter(r => !userIgnoredIds.has(r.id)).slice(0, 40)
      .map(r => { const o = 0.001; const lo = fix(r.lng); const la = fix(r.lat); return [[lo-o, la-o], [lo+o, la-o], [lo+o, la+o], [lo-o, la+o]]; });

    if (finalPolygons.length > 0) {
      drivingRef.current.setAvoidPolygons(finalPolygons);
      finalPolygons.forEach(p => {
        const poly = new AMap.Polygon({ path: p.map((c:any) => new AMap.LngLat(c[0], c[1])), fillColor: '#ef4444', fillOpacity: 0.1, strokeColor: '#ef4444', strokeWeight: 1 });
        mapRef.current.add(poly); polygonOverlaysRef.current.push(poly);
      });
    }

    const sC = getSafeLngLat(startPoint[0], startPoint[1]);
    const eC = getSafeLngLat(endPoint[0], endPoint[1]);
    drivingRef.current.search(new AMap.LngLat(sC.lng, sC.lat), new AMap.LngLat(eC.lng, eC.lat), (status: string, result: any) => {
      if (status === 'complete' && result.routes?.[0]) {
        const finalPts: any[] = [];
        result.routes[0].steps.forEach((s: any) => s.path.forEach((p: any) => finalPts.push({ lng: p.lng, lat: p.lat })));
        setRouteRisks(Array.from(scanPathRisks(finalPts, 6).values()));
      }
      setPlanningStatus(null);
    });
  }, [startPoint, endPoint, userIgnoredIds]);

  useEffect(() => { if (masterAvoidList.size > 0) planRoute(true); }, [userIgnoredIds]);

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-900 overflow-hidden text-slate-200">
      <div className="absolute top-4 left-4 z-[2000] w-96 max-h-[calc(100vh-32px)] flex flex-col pointer-events-none">
        <div className="bg-slate-950/90 backdrop-blur shadow-2xl rounded-[32px] p-6 border border-white/5 pointer-events-auto flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-8 px-1">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20"><Navigation className="text-white w-5 h-5 fill-current" /></div>
              <h2 className="font-black text-white text-lg">北京避让导航</h2>
            </div>
            {planningStatus && <span className="text-[10px] bg-indigo-600 px-2 py-1 rounded-lg animate-pulse font-bold tracking-widest">{planningStatus}</span>}
          </div>

          <div className="space-y-3 mb-8">
            <input id="start-input" type="text" placeholder="起点位置" value={startName} onChange={e => setStartName(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 px-5 text-xs text-white font-bold" />
            <input id="end-input" type="text" placeholder="目的地" value={endName} onChange={e => setEndName(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 px-5 text-xs text-white font-bold" />
          </div>

          <button onClick={() => planRoute()} disabled={!startPoint || !endPoint || planningStatus !== null} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-blue-700 disabled:bg-slate-800 transition-all flex items-center justify-center space-x-2">
            {planningStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>{planningStatus ? 'AI 深度避让中...' : '生成避让方案'}</span>
          </button>

          {(masterAvoidList.size > 0) && (
            <div className="mt-8 flex-1 overflow-hidden flex flex-col border-t border-white/5 pt-6">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center space-x-2"><ShieldAlert className="w-4 h-4 text-red-500" /><span>路径风险管控中心 ({masterAvoidList.size})</span></h3>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar text-[11px]">
                {Array.from(masterAvoidList.values()).map(r => (
                  <div key={r.id} className={`p-4 rounded-[22px] border-2 transition-all flex items-center justify-between ${userIgnoredIds.has(r.id) ? 'bg-slate-900 border-white/5 opacity-50' : (routeRisks.find(rr => rr.id === r.id) ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30')}`}>
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <img src={`/images/${r.aa}.png`} alt="" className="w-4 h-5 object-contain" />
                      <span className={`font-bold truncate pr-2 ${userIgnoredIds.has(r.id) ? 'text-slate-500 line-through' : (routeRisks.find(rr => rr.id === r.id) ? 'text-red-400' : 'text-emerald-400')}`}>{r.name}</span>
                    </div>
                    <div onClick={() => setUserIgnoredIds(prev => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} className={`cursor-pointer p-2 rounded-xl transition-all ${userIgnoredIds.has(r.id) ? 'bg-slate-800 text-slate-600' : 'bg-white/5 text-blue-400 hover:bg-blue-600 hover:text-white'}`}>
                      {userIgnoredIds.has(r.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-4 right-4 z-[2000] w-80 h-[400px] bg-slate-950/80 backdrop-blur shadow-2xl rounded-[32px] p-5 border border-white/10 pointer-events-auto flex flex-col overflow-hidden">
        <div className="flex items-center space-x-2 mb-4 border-b border-white/5 pb-3"><Terminal className="text-emerald-500 w-4 h-4" /><h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-emerald-500">Algorithm Log</h3></div>
        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar text-[10px] font-mono leading-relaxed">
          {debugLogs.map((l, i) => (<div key={i} className="flex space-x-2"><span className="text-slate-600">[{l.round}]</span><div className={`${l.type === 'success' ? 'text-emerald-400 font-bold' : ''} ${l.type === 'warn' ? 'text-orange-400' : ''} ${l.type === 'ignore' ? 'text-slate-500 italic' : ''} ${l.type === 'info' ? 'text-blue-400' : ''}`}>{l.message}</div></div>))}
          <div ref={debugEndRef} />
        </div>
      </div>

      <div id="container" className="flex-1 w-full h-full" />
      <style jsx global>{`
        .amap-sug-result { z-index: 9999 !important; border: none !important; border-radius: 24px !important; box-shadow: 0 30px 60px rgba(0,0,0,0.5) !important; padding: 16px !important; background: #0f172a !important; color: white !important; }
        .auto-item { padding: 14px 20px !important; font-size: 14px !important; color: #f1f5f9 !important; font-weight: 800 !important; cursor: pointer !important; border-radius: 16px !important; }
        .auto-item:hover { background-color: #1e293b !important; color: #4f46e5 !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default MapContainer;
