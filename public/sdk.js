// 系统只读接口。每台机器人有独立 memory；坐标为 960 × 640。
function wrapRobot(r) {
  return {...r,
    distance_to(t){return Math.hypot(this.x-t.x,this.y-t.y);},
    move_to(x,y){return typeof x==='object'?{type:'move',x:x.x,y:x.y}:{type:'move',x,y};},
    gather(t){return t?{type:'gather',target_id:t.id}:this.idle();},
    attack(t){return t?{type:'attack',target_id:t.id}:this.idle();},
    idle(){return {type:'idle'};},
    follow(points,memory,key='route',loop=true){
      if(!points.length)return this.idle();
      let i=Math.max(0,Math.min(Math.trunc(memory[key]||0),points.length-1));
      if(Math.hypot(this.x-points[i][0],this.y-points[i][1])<20)i=loop?(i+1)%points.length:Math.min(i+1,points.length-1);
      memory[key]=i;return this.move_to(...points[i]);
    }
  };
}
function dispatch(roles,observation,memory){
  const world={...observation,robots:observation.robots.map(wrapRobot),
    nearest_resource(r){return [...this.resources].sort((a,b)=>r.distance_to(a)-r.distance_to(b))[0];},
    nearest_enemy(r){return [...this.enemies].sort((a,b)=>r.distance_to(a)-r.distance_to(b))[0];}};
  const actions={};
  for(const r of world.robots)actions[r.id]=r.alive?roles[r.role.toLowerCase()](r,world,memory[r.id]??={}):r.idle();
  return [actions,memory];
}
