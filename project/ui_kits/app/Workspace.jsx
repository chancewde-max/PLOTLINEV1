/* Plotline takeoff workspace — the product's core screen.
   Topbar · tool rail · sheets/layers panel · plan canvas · estimate panel. */

const WS_CSS = `
.ws{ position:fixed; inset:0; display:flex; flex-direction:column; background:var(--bg-app); font-family:var(--font-sans); color:var(--text-body); }
.ws *{ box-sizing:border-box; }

/* Topbar */
.ws-top{ height:var(--topbar); flex:0 0 auto; display:flex; align-items:center; gap:var(--space-6); padding:0 var(--space-6); background:var(--surface-card); border-bottom:1px solid var(--border-default); z-index:5; }
.ws-brand{ display:flex; align-items:center; gap:9px; }
.ws-brand img{ width:26px; height:26px; }
.ws-brand b{ font-family:var(--font-display); font-weight:700; font-size:17px; letter-spacing:-0.02em; color:var(--text-strong); }
.ws-brand .dot{ color:var(--brand-600); }
.ws-crumb{ display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-muted); }
.ws-crumb .sep{ color:var(--border-strong); }
.ws-crumb b{ color:var(--text-strong); font-weight:600; }
.ws-top-right{ margin-left:auto; display:flex; align-items:center; gap:var(--space-5); }
.ws-zoom{ display:flex; align-items:center; gap:2px; background:var(--surface-sunken); border:1px solid var(--border-default); border-radius:var(--radius-md); padding:2px; }
.ws-zoom .z{ width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; border:none; background:transparent; border-radius:var(--radius-sm); color:var(--text-body); cursor:pointer; }
.ws-zoom .z:hover{ background:var(--surface-card); }
.ws-zoom .val{ font-family:var(--font-mono); font-size:12px; color:var(--text-body); min-width:42px; text-align:center; }
.ws-avatars{ display:flex; }
.ws-avatars > *{ margin-left:-8px; }

/* Body grid */
.ws-body{ flex:1 1 auto; display:flex; min-height:0; }
.ws-rail{ width:var(--rail-left); flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:var(--space-3); padding:var(--space-5) 0; background:var(--surface-card); border-right:1px solid var(--border-default); }
.ws-rail .tool{ position:relative; width:40px; height:40px; display:inline-flex; align-items:center; justify-content:center; border:1px solid transparent; border-radius:var(--radius-md); background:transparent; color:var(--text-body); cursor:pointer; transition:background var(--dur-fast) var(--ease-standard); }
.ws-rail .tool:hover{ background:var(--surface-muted); }
.ws-rail .tool[data-on="true"]{ background:var(--brand-600); color:#fff; border-color:var(--brand-700); }
.ws-rail .tool .kbd{ position:absolute; right:2px; bottom:1px; font-family:var(--font-mono); font-size:8px; color:var(--text-subtle); }
.ws-rail .tool[data-on="true"] .kbd{ color:rgba(255,255,255,.7); }
.ws-rail .sep{ width:24px; height:1px; background:var(--border-subtle); margin:2px 0; }

/* Left panel */
.ws-left{ width:var(--panel-left); flex:0 0 auto; display:flex; flex-direction:column; background:var(--surface-card); border-right:1px solid var(--border-default); min-height:0; }
.ws-left .ph{ padding:var(--space-5) var(--space-6) var(--space-4); display:flex; align-items:center; justify-content:space-between; }
.ws-left .ph h3{ margin:0; font-family:var(--font-display); font-size:15px; font-weight:600; color:var(--text-strong); }
.ws-tabs{ padding:0 var(--space-5); }
.ws-scroll{ overflow:auto; padding:var(--space-5) var(--space-6); display:flex; flex-direction:column; gap:var(--space-4); }
.ws-layer{ display:flex; align-items:center; gap:10px; }
.ws-layer .eye{ width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; border:none; background:transparent; border-radius:var(--radius-sm); color:var(--text-subtle); cursor:pointer; flex:0 0 auto; }
.ws-layer .eye:hover{ background:var(--surface-muted); color:var(--text-body); }
.ws-layer .eye[data-off="true"]{ color:var(--border-strong); }
.ws-sheets-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }

/* Canvas */
.ws-canvas{ flex:1 1 auto; position:relative; background:var(--bg-canvas); background-image:var(--grid-blueprint); background-size:var(--grid-size) var(--grid-size); display:flex; align-items:center; justify-content:center; overflow:hidden; min-width:0; }
.ws-sheet-wrap{ transition:transform var(--dur-base) var(--ease-out); }
.ws-sheet{ position:relative; background:var(--surface-paper); border:1px solid var(--paper-edge); border-radius:3px; box-shadow:var(--sheet-shadow); background-image:linear-gradient(var(--paper-line) 1px,transparent 1px),linear-gradient(90deg,var(--paper-line) 1px,transparent 1px); background-size:24px 24px; }
.ws-titleblock{ position:absolute; right:14px; bottom:14px; width:150px; border:1px solid var(--paper-edge); background:rgba(255,255,255,.6); border-radius:3px; font-family:var(--font-mono); font-size:9px; color:var(--text-muted); }
.ws-titleblock div{ padding:4px 7px; border-bottom:1px solid var(--paper-edge); }
.ws-titleblock div:last-child{ border-bottom:none; }
.ws-titleblock b{ color:var(--text-strong); font-size:11px; }
.ws-callout{ position:absolute; transform:translate(-50%,-50%); font-family:var(--font-mono); font-size:11px; font-weight:600; padding:3px 7px; border-radius:var(--radius-sm); white-space:nowrap; box-shadow:var(--shadow-sm); pointer-events:none; }
.ws-hint{ position:absolute; top:12px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-body); background:var(--surface-card); border:1px solid var(--border-default); border-radius:var(--radius-pill); padding:6px 14px; box-shadow:var(--shadow-sm); }
.ws-hint b{ color:var(--text-strong); }
.ws-scale{ position:absolute; left:14px; bottom:14px; display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:11px; color:var(--text-body); background:var(--surface-card); border:1px solid var(--border-default); border-radius:var(--radius-sm); padding:5px 10px; box-shadow:var(--shadow-xs); }
.ws-scale .ruler{ width:46px; height:6px; border:1px solid var(--text-body); border-top:none; }

/* Right panel */
.ws-right{ width:var(--panel-right); flex:0 0 auto; display:flex; flex-direction:column; background:var(--surface-card); border-left:1px solid var(--border-default); min-height:0; }
.ws-right .ph{ padding:var(--space-6); display:flex; flex-direction:column; gap:3px; border-bottom:1px solid var(--border-subtle); }
.ws-right .ph h3{ margin:0; font-family:var(--font-display); font-size:16px; font-weight:600; color:var(--text-strong); }
.ws-right .ph span{ font-size:12px; color:var(--text-muted); }
.ws-est{ flex:1 1 auto; overflow:auto; }
.ws-est-foot{ padding:var(--space-6); border-top:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:var(--space-5); }
`;
if (!document.getElementById("ws-css")) {
  const el = document.createElement("style"); el.id = "ws-css"; el.textContent = WS_CSS; document.head.appendChild(el);
}

const TOOLS = [
  { id: "pan", label: "Pan", icon: "hand", k: "H" },
  { id: "area", label: "Area", icon: "square-dashed", k: "A" },
  { id: "linear", label: "Linear", icon: "spline", k: "L" },
  { id: "count", label: "Count", icon: "locate", k: "C" },
  { id: "volume", label: "Volume", icon: "box", k: "V" },
  "sep",
  { id: "scale", label: "Set scale", icon: "ruler", k: "S" },
  { id: "note", label: "Note", icon: "message-square", k: "N" },
];

// Measurements with geometry on the sheet (sheet viewBox 880x620)
const MEAS = [
  { id: "a1", type: "area", label: "Sod — rear lawn", value: "4,820", unit: "sq ft", qty: 4820,
    poly: "120,150 470,130 520,360 150,400", cx: 300, cy: 270 },
  { id: "a2", type: "area", label: "Sod — side yard", value: "1,640", unit: "sq ft", qty: 1640,
    poly: "560,120 690,135 700,300 575,300", cx: 628, cy: 215 },
  { id: "v1", type: "volume", label: "Mulch beds 3″", value: "38", unit: "cu yd", qty: 38,
    poly: "150,430 360,430 360,510 150,510", cx: 255, cy: 470 },
  { id: "l1", type: "linear", label: "Steel edging", value: "312", unit: "ln ft", qty: 312,
    line: "120,150 470,130 520,360 150,400 120,150", cx: 90, cy: 275 },
  { id: "c1", type: "count", label: "Shade trees", value: "9", unit: "ea", qty: 9,
    pts: [[200,190],[330,175],[440,200],[250,330],[400,320],[610,170],[660,260],[230,470],[320,470]] },
];

const TYPE_COLOR = { area:"var(--takeoff-area)", linear:"var(--takeoff-linear)", count:"var(--takeoff-count)", volume:"var(--takeoff-volume)", region:"var(--takeoff-region)", slope:"var(--takeoff-slope)" };
const TYPE_BG = { area:"var(--takeoff-area-bg)", linear:"var(--takeoff-linear-bg)", count:"var(--takeoff-count-bg)", volume:"var(--takeoff-volume-bg)" };

function Workspace({ onExport }) {
  const { Tabs, Badge, Avatar, Button, MeasurementChip, Tooltip } = window.PlotlineDesignSystem_0cdb69;
  const [tool, setTool] = React.useState("area");
  const [zoom, setZoom] = React.useState(100);
  const [sel, setSel] = React.useState("a1");
  const [panel, setPanel] = React.useState("layers");
  const [hidden, setHidden] = React.useState({});
  const sheetW = 880, sheetH = 620, scale = 0.62;

  const toggle = (id) => setHidden((h) => ({ ...h, [id]: !h[id] }));
  const visible = (m) => !hidden[m.id];

  return (
    <div className="ws">
      {/* Topbar */}
      <div className="ws-top">
        <div className="ws-brand">
          <img src="../../assets/plotline-mark.svg" alt=""/>
          <b>Plotline<span className="dot">.</span></b>
        </div>
        <div className="ws-crumb">
          <span>Maple Grove Estates</span><span className="sep">/</span><b>L-2 · Planting Plan</b>
        </div>
        <div className="ws-top-right">
          <div className="ws-zoom">
            <button className="z" onClick={() => setZoom((z)=>Math.max(25,z-25))}><KitIcon name="minus" size={15}/></button>
            <span className="val">{zoom}%</span>
            <button className="z" onClick={() => setZoom((z)=>Math.min(200,z+25))}><KitIcon name="plus" size={15}/></button>
          </div>
          <Badge variant="success" dot>Synced</Badge>
          <div className="ws-avatars">
            <Avatar name="Amy Reyes" size="sm" ring status="online"/>
            <Avatar name="Jordan Tate" size="sm" ring/>
          </div>
          <Button size="sm" variant="secondary" iconLeft={<KitIcon name="share-2" size={15}/>}>Share</Button>
          <Button size="sm" variant="primary" iconLeft={<KitIcon name="file-down" size={15}/>} onClick={onExport}>Export</Button>
        </div>
      </div>

      <div className="ws-body">
        {/* Tool rail */}
        <div className="ws-rail">
          {TOOLS.map((t,i)=> t==="sep"
            ? <div className="sep" key={"s"+i}/>
            : <Tooltip key={t.id} label={t.label} shortcut={t.k} side="bottom">
                <button className="tool" data-on={tool===t.id} onClick={()=>setTool(t.id)} aria-label={t.label}>
                  <KitIcon name={t.icon} size={20}/>
                  <span className="kbd">{t.k}</span>
                </button>
              </Tooltip>
          )}
        </div>

        {/* Left panel */}
        <div className="ws-left">
          <div className="ws-tabs" style={{paddingTop:12}}>
            <Tabs variant="pill" value={panel} onChange={setPanel}
              items={[{value:"layers",label:"Layers",count:MEAS.length},{value:"sheets",label:"Sheets",count:3}]}/>
          </div>
          {panel==="layers" ? (
            <div className="ws-scroll">
              {MEAS.map(m=>(
                <div className="ws-layer" key={m.id}>
                  <button className="eye" data-off={!visible(m)} onClick={()=>toggle(m.id)} aria-label="Toggle visibility">
                    <KitIcon name={visible(m)?"eye":"eye-off"} size={16}/>
                  </button>
                  <div style={{flex:1,minWidth:0}}>
                    <MeasurementChip type={m.type} label={m.label} value={m.value} unit={m.unit}
                      selected={sel===m.id} onClick={()=>setSel(m.id)}/>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ws-scroll">
              <div className="ws-sheets-grid">
                {window.PlotlineDesignSystem_0cdb69.SheetThumb
                  ? [["L-1","Site Plan",`1"=30'`,8,false],["L-2","Planting",`1"=20'`,MEAS.length,true],["L-3","Grading",`1"=20'`,5,false],["D-1","Details",`NTS`,2,false]]
                      .map(([code,name,sc,ct,on])=>React.createElement(window.PlotlineDesignSystem_0cdb69.SheetThumb,{key:code,code,name,scale:sc,count:ct,selected:on}))
                  : null}
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="ws-canvas" data-tool={tool}>
          <div className="ws-hint">
            <KitIcon name={tool==="pan"?"hand":tool==="area"?"square-dashed":tool==="linear"?"spline":tool==="count"?"locate":tool==="volume"?"box":tool==="scale"?"ruler":"message-square"} size={15}/>
            {tool==="pan" ? <span>Drag to pan · scroll to zoom</span>
              : tool==="scale" ? <span><b>Set scale</b> · click two points of known distance</span>
              : <span><b>{TOOLS.find(t=>t.id===tool)?.label}</b> tool · click to place vertices, double-click to finish</span>}
          </div>

          <div className="ws-sheet-wrap" style={{transform:`scale(${(zoom/100)*scale})`}}>
            <div className="ws-sheet" style={{width:sheetW,height:sheetH}}>
              <svg width={sheetW} height={sheetH} viewBox={`0 0 ${sheetW} ${sheetH}`} style={{position:"absolute",inset:0}}>
                {MEAS.filter(visible).map(m=>{
                  const c = TYPE_COLOR[m.type]; const on = sel===m.id;
                  if (m.poly) {
                    const fill = m.type==="volume" ? "rgba(124,58,237,.13)" : "rgba(46,158,79,.15)";
                    return <g key={m.id} onClick={()=>setSel(m.id)} style={{cursor:"pointer"}}>
                      <polygon points={m.poly} fill={fill} stroke={c} strokeWidth={on?3:2} strokeDasharray={m.type==="volume"?"7 5":"0"}/>
                      {on && m.poly.split(" ").map((p,idx)=>{const[x,y]=p.split(",");return <rect key={idx} x={+x-4} y={+y-4} width="8" height="8" fill="#fff" stroke={c} strokeWidth="2"/>;})}
                    </g>;
                  }
                  if (m.line) {
                    return <g key={m.id} onClick={()=>setSel(m.id)} style={{cursor:"pointer"}}>
                      <polyline points={m.line} fill="none" stroke={c} strokeWidth={on?4:3} strokeLinecap="round" strokeLinejoin="round"/>
                    </g>;
                  }
                  if (m.pts) {
                    return <g key={m.id} onClick={()=>setSel(m.id)} style={{cursor:"pointer"}}>
                      {m.pts.map(([x,y],idx)=>(
                        <g key={idx}>
                          <circle cx={x} cy={y} r={on?9:8} fill="#fff" stroke={c} strokeWidth={on?3:2}/>
                          <circle cx={x} cy={y} r="3" fill={c}/>
                        </g>
                      ))}
                    </g>;
                  }
                  return null;
                })}
              </svg>

              {/* Callouts for selected / area+volume */}
              {MEAS.filter(m=>visible(m)&&m.cx).map(m=>{
                const c=TYPE_COLOR[m.type]; const bg=TYPE_BG[m.type]||"#fff"; const on=sel===m.id;
                return <div key={m.id} className="ws-callout"
                  style={{left:`${(m.cx/sheetW)*100}%`,top:`${(m.cy/sheetH)*100}%`,background:on?c:bg,color:on?"#fff":c,border:`1px solid ${on?c:"transparent"}`}}>
                  {m.value} {m.unit}
                </div>;
              })}

              <div className="ws-titleblock">
                <div><b>PLANTING PLAN</b></div>
                <div>Maple Grove Estates</div>
                <div>SHEET L-2 · 1" = 20'-0"</div>
              </div>
            </div>
          </div>

          <div className="ws-scale"><span className="ruler"></span> 20'-0" · 1" = 20'</div>
        </div>

        {/* Estimate panel */}
        <div className="ws-right">
          <div className="ph">
            <h3>Estimate</h3>
            <span>Maple Grove Estates · live from takeoff</span>
          </div>
          <div className="ws-est">
            {(() => { const ER = window.PlotlineDesignSystem_0cdb69.EstimateRow; return <React.Fragment>
              <ER header/>
              <ER type="area"   name="Sod & turf"     source="L-2 · 2 areas" quantity="6,460"  unit="sq ft" unitPrice="$0.85 / sq ft" total="$5,491"/>
              <ER type="linear" name="Steel edging"   source="L-2 · 1 run"   quantity="312"    unit="ln ft" unitPrice="$6.20 / ln ft" total="$1,934"/>
              <ER type="count"  name="Shade trees"    source="L-2 · 9 pts"   quantity="9"      unit="ea"    unitPrice="$420 / ea"     total="$3,780"/>
              <ER type="volume" name="Mulch, 3″ beds" source="L-2 · 1 region" quantity="38"    unit="cu yd" unitPrice="$52 / cu yd"   total="$1,976"/>
            </React.Fragment>; })()}
          </div>
          <div className="ws-est-foot">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
              <span style={{fontSize:13,color:"var(--text-muted)"}}>Subtotal · 4 categories</span>
              <span style={{fontFamily:"var(--font-mono)",fontWeight:600,fontSize:15,color:"var(--text-strong)"}}>$13,181</span>
            </div>
            <Button variant="primary" fullWidth iconLeft={<KitIcon name="file-down" size={16}/>} onClick={onExport}>Export estimate</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Workspace });
