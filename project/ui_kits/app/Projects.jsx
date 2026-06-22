/* Plotline projects dashboard — landing screen of the app. */

const PRJ_CSS = `
.prj{ position:fixed; inset:0; display:flex; flex-direction:column; background:var(--bg-app); font-family:var(--font-sans); color:var(--text-body); overflow:auto; }
.prj-top{ height:var(--topbar); flex:0 0 auto; display:flex; align-items:center; gap:var(--space-7); padding:0 var(--space-8); background:var(--surface-card); border-bottom:1px solid var(--border-default); position:sticky; top:0; z-index:5; }
.prj-brand{ display:flex; align-items:center; gap:9px; }
.prj-brand img{ width:26px; height:26px; }
.prj-brand b{ font-family:var(--font-display); font-weight:700; font-size:17px; letter-spacing:-0.02em; color:var(--text-strong); }
.prj-brand .dot{ color:var(--brand-600); }
.prj-nav{ display:flex; align-items:center; gap:2px; }
.prj-nav a{ font-size:13px; font-weight:600; color:var(--text-muted); padding:6px 11px; border-radius:var(--radius-sm); text-decoration:none; cursor:pointer; }
.prj-nav a[data-on="true"]{ color:var(--text-strong); background:var(--surface-muted); }
.prj-search{ margin-left:auto; }
.prj-main{ max-width:1120px; width:100%; margin:0 auto; padding:var(--space-9) var(--space-8) var(--space-12); }
.prj-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:var(--space-7); }
.prj-head h1{ font-family:var(--font-display); font-size:30px; font-weight:600; letter-spacing:-0.02em; color:var(--text-strong); margin:0 0 4px; }
.prj-head p{ margin:0; color:var(--text-muted); font-size:14px; }
.prj-stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:var(--space-8); }
.prj-stat{ background:var(--surface-card); border:1px solid var(--border-default); border-radius:var(--radius-lg); padding:var(--space-6); }
.prj-stat .k{ font-size:12px; color:var(--text-muted); }
.prj-stat .v{ font-family:var(--font-mono); font-size:26px; font-weight:600; color:var(--text-strong); margin-top:4px; letter-spacing:-0.01em; }
.prj-stat .v.brand{ color:var(--text-brand); }
.prj-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
.prj-card{ display:flex; flex-direction:column; background:var(--surface-card); border:1px solid var(--border-default); border-radius:var(--radius-lg); overflow:hidden; cursor:pointer; transition:box-shadow var(--dur-base) var(--ease-standard), transform var(--dur-base) var(--ease-standard), border-color var(--dur-base) var(--ease-standard); }
.prj-card:hover{ box-shadow:var(--shadow-md); transform:translateY(-2px); border-color:var(--border-strong); }
.prj-prev{ position:relative; aspect-ratio:16/9; background:var(--paper-0); background-image:linear-gradient(var(--paper-line) 1px,transparent 1px),linear-gradient(90deg,var(--paper-line) 1px,transparent 1px); background-size:18px 18px; border-bottom:1px solid var(--border-subtle); overflow:hidden; }
.prj-prev .badge{ position:absolute; top:10px; right:10px; }
.prj-prev svg{ position:absolute; inset:0; }
.prj-card-body{ padding:var(--space-6); display:flex; flex-direction:column; gap:10px; }
.prj-card-body h3{ margin:0; font-size:16px; font-weight:600; color:var(--text-strong); }
.prj-card-body .client{ font-size:13px; color:var(--text-muted); margin-top:-6px; }
.prj-meta{ display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px solid var(--border-subtle); }
.prj-meta .sheets{ font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:6px; }
.prj-meta .bid{ font-family:var(--font-mono); font-weight:600; font-size:15px; color:var(--text-strong); }
`;
if (!document.getElementById("prj-css")) {
  const el = document.createElement("style"); el.id="prj-css"; el.textContent=PRJ_CSS; document.head.appendChild(el);
}

const PROJECTS = [
  { name:"Maple Grove Estates", client:"Hilltop Developments", sheets:3, bid:"$48,210", status:["success","Bid sent"], poly:"30,70 150,55 175,120 45,135", color:"var(--takeoff-area)" },
  { name:"Riverside Commons", client:"City of Fairview", sheets:6, bid:"$182,400", status:["warning","Draft"], poly:"40,40 180,60 170,130 30,110", color:"var(--takeoff-volume)" },
  { name:"Oakmont Clubhouse", client:"Oakmont HOA", sheets:4, bid:"$96,750", status:["brand","Won"], poly:"50,50 160,45 185,120 60,135", color:"var(--takeoff-linear)" },
  { name:"Cedar Park Trailhead", client:"Parks & Rec", sheets:2, bid:"$31,900", status:["success","Bid sent"], line:"30,120 80,60 130,100 185,50", color:"var(--takeoff-count)" },
  { name:"Lakeshore Townhomes", client:"Beacon Living", sheets:5, bid:"$124,000", status:["neutral","Archived"], poly:"35,60 175,50 165,125 45,120", color:"var(--takeoff-region)" },
  { name:"Summit Office Park", client:"Vantage RE", sheets:7, bid:"$210,500", status:["warning","Draft"], poly:"45,45 170,65 180,125 30,115", color:"var(--takeoff-slope)" },
];

function Projects({ onOpen }) {
  const { Input, Button, Badge, Avatar } = window.PlotlineDesignSystem_0cdb69;
  return (
    <div className="prj">
      <div className="prj-top">
        <div className="prj-brand"><img src="../../assets/plotline-mark.svg" alt=""/><b>Plotline<span className="dot">.</span></b></div>
        <div className="prj-nav">
          <a data-on="true">Projects</a><a>Templates</a><a>Pricebook</a><a>Team</a>
        </div>
        <div className="prj-search" style={{width:240}}>
          <Input placeholder="Search projects…" size="sm" leadingIcon={<KitIcon name="search" size={15}/>}/>
        </div>
        <Avatar name="Amy Reyes" status="online"/>
      </div>

      <div className="prj-main">
        <div className="prj-head">
          <div>
            <h1>Projects</h1>
            <p>6 active · 2 awaiting decision</p>
          </div>
          <Button variant="primary" iconLeft={<KitIcon name="plus" size={16}/>} onClick={()=>onOpen(PROJECTS[0])}>New project</Button>
        </div>

        <div className="prj-stats">
          <div className="prj-stat"><div className="k">Open bids</div><div className="v">6</div></div>
          <div className="prj-stat"><div className="k">Pipeline value</div><div className="v brand">$693,760</div></div>
          <div className="prj-stat"><div className="k">Win rate (90d)</div><div className="v">42%</div></div>
          <div className="prj-stat"><div className="k">Sheets measured</div><div className="v">27</div></div>
        </div>

        <div className="prj-grid">
          {PROJECTS.map((p,i)=>(
            <div className="prj-card" key={i} onClick={()=>onOpen(p)}>
              <div className="prj-prev">
                <svg viewBox="0 0 220 160" fill="none">
                  {p.poly && <polygon points={p.poly} fill={p.color} fillOpacity="0.16" stroke={p.color} strokeWidth="2.5"/>}
                  {p.line && <polyline points={p.line} fill="none" stroke={p.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>}
                </svg>
                <span className="badge"><Badge variant={p.status[0]} dot={p.status[0]==="success"}>{p.status[1]}</Badge></span>
              </div>
              <div className="prj-card-body">
                <div>
                  <h3>{p.name}</h3>
                  <div className="client">{p.client}</div>
                </div>
                <div className="prj-meta">
                  <span className="sheets"><KitIcon name="map" size={14}/> {p.sheets} sheets</span>
                  <span className="bid">{p.bid}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Projects });
