// Bloques nuevos: se dispara a cada uno en su nivel de estreno y se cuenta lo que pasa (node tools/newblocks.js)
global.CANNON=require(__dirname + '/../vendor/cannon-es.cjs.js');
const S=require(__dirname + '/../src/sim3d.js'), L=require(__dirname + '/../src/levels3d.js');
for (const [id,kind] of [[4,'rocket'],[15,'pinata'],[22,'hourglass'],[65,'mirror'],[84,'spring'],[127,'geyser'],[158,'portal']]) {
  const l=L.byId(id), s=new S.Sim(l);
  let t = s.blocks.find(b=>b.userData.kind===kind && (kind!=='portal'||b.userData.a));
  const evs={}; const q0=s.queue.length;
  for (let shot=0; shot<(kind==='pinata'?2:1); shot++){
    s.sinceFire=9; const p=t.position; s.fire(p.x,p.y,p.z);
    for(let i=0;i<120*4;i++){ s.step(); for(const e of s.events) evs[e.type]=(evs[e.type]||0)+1; s.events.length=0; }
  }
  console.log(id,kind,'progress',s.progress().toFixed(2),'queue',q0,'->',s.queue.length,'coins',s.coins, JSON.stringify(evs));
}
