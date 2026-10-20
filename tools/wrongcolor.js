// Bola de un color contra un bloque de otro color: no debe reventar nada (node tools/wrongcolor.js [paso])
// También mide que la cascada de verdad (bloques que caen sobre los de su color) sigue funcionando.
global.CANNON=require(__dirname + '/../vendor/cannon-es.cjs.js');
const Sm=require(__dirname + '/../src/sim3d.js'), L=require(__dirname + '/../src/levels3d.js');
const step=+process.argv[2]||1, COLS=['r','g','b','y','p'];
let n=0, bad=0, casc=0; const badIds=[];
for (const l of L.ALL) {
  if (l.id % step) continue;
  const s=new Sm.Sim(l);
  const blocks=s.blocks.filter(b=>b.userData.kind==='block' && b.userData.c);
  if (!blocks.length) continue;
  // el bloque más expuesto hacia el cañón y una bola de un color que no esté en su grupo
  const t=blocks.reduce((a,b)=>b.position.z>a.position.z?b:a);
  const c=COLS.find(x=>x!==t.userData.c);
  s.queue[0]=c; s.sinceFire=9; s.fire(t.position.x,t.position.y,t.position.z);
  let wrong=0;
  for(let i=0;i<120*3;i++){ s.step(); for(const e of s.events){ if(e.type==='cascade') wrong++; } s.events.length=0; }
  n++; if (wrong) { bad++; badIds.push(l.id); }
  // cascada de verdad: se quita el apoyo de un bloque que tiene encima otro de su mismo color
  const s2=new Sm.Sim(l);
  const bs=s2.blocks.filter(b=>b.userData.kind==='block'&&b.userData.c);
  const top=bs.find(a=>bs.some(u=>u!==a&&u.userData.c===a.userData.c&&Math.abs(u.position.x-a.position.x)<0.3&&Math.abs(u.position.z-a.position.z)<0.3&&u.position.y<a.position.y-1.5)&&bs.some(m=>m.userData.c!==a.userData.c&&Math.abs(m.position.x-a.position.x)<0.3&&Math.abs(m.position.z-a.position.z)<0.3&&Math.abs(m.position.y-a.position.y+1)<0.3));
  if (top) {
    const mid=bs.find(m=>m.userData.c!==top.userData.c&&Math.abs(m.position.x-top.position.x)<0.3&&Math.abs(m.position.z-top.position.z)<0.3&&Math.abs(m.position.y-top.position.y+1)<0.3);
    s2.queue[0]=mid.userData.c; s2.sinceFire=9; s2.fire(mid.position.x,mid.position.y,mid.position.z);
    let cc=0; for(let i=0;i<120*3;i++){ s2.step(); for(const e of s2.events){ if(e.type==='cascade') cc++; } s2.events.length=0; }
    if (cc) casc++;
  }
}
console.log('niveles',n,'· con bola de otro color que revienta bloques:',bad,'('+(100*bad/n).toFixed(0)+'%)','· con cascada al caer:',casc);
console.log('ejemplos', badIds.slice(0,25).join(' '));
