# 系统提供的只读接口；策略只需定义 scout、guard、hauler。
import math

class Entity(dict):
    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError("字段不存在：" + name)

class Robot(Entity):
    # id / role：编号、角色；x / y：坐标；hp / maxHp：当前/最大血量
    # cargo：携带能量；cargoSlots / capacity：已占/总格数；alive：是否存活
    def distance_to(self, target):
        return math.hypot(self.x - target["x"], self.y - target["y"])

    def move_to(self, x, y=None):
        """前往坐标，或 move_to(world.base / 资源 / 机器人)。"""
        if y is None:
            x, y = x["x"], x["y"]
        return {"type": "move", "x": x, "y": y}

    def gather(self, resource):
        """自动接近并采集；目标为空则等待。"""
        return {"type": "gather", "target_id": resource["id"]} if resource else self.idle()

    def attack(self, enemy):
        """自动接近并攻击敌人。"""
        return {"type": "attack", "target_id": enemy["id"]} if enemy else self.idle()

    def idle(self):
        return {"type": "idle"}

    def follow(self, points, memory, key="route", loop=True):
        """沿 [(x,y), ...] 逐点行进；memory 保存进度，各机器人独立。"""
        if not points:
            return self.idle()
        index = max(0, min(int(memory.get(key, 0)), len(points)-1))
        x, y = points[index]
        if math.hypot(self.x-x, self.y-y) < 20:
            index = (index+1) % len(points) if loop else min(index+1, len(points)-1)
        memory[key] = index
        return self.move_to(*points[index])

class World(Entity):
    # time：模拟秒；tick：物理步；base：己方基地；scores：所有队伍交付分
    # resources：可采资源（id,x,y,amount,value,core）；enemies：活着的敌人
    def __init__(self, observation):
        super().__init__(observation)
        self["base"] = Entity(self["base"])
        for key in ("robots", "enemies", "resources"):
            self[key] = [Robot(v) if key != "resources" else Entity(v) for v in self[key]]

    def nearest_resource(self, robot):
        return min(self.resources, key=robot.distance_to, default=None)

    def nearest_enemy(self, robot):
        return min(self.enemies, key=robot.distance_to, default=None)

def _dispatch(observation, memory):
    world = World(observation)
    actions = {}
    for robot in world.robots:
        own_memory = memory.setdefault(robot.id, {})
        actions[robot.id] = globals()[robot.role.lower()](robot, world, own_memory) if robot.alive else robot.idle()
    return actions, memory
