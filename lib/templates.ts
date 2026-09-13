export const PYTHON = `# 每 0.2 秒模拟时间调用一次。无需自己写循环！
# 三个函数各控制一台机器人；memory 是该机器人的独立记忆。
# 修改路线/目标/判断后，运行训练；已提交的联机轮次不会被修改。

def collect(robot, world):
    # cargoSlots 是已占格数，cargo 是能量值（核心一格值 20）。
    if robot.cargoSlots >= robot.capacity or robot.hp < robot.maxHp * 0.3:
        return robot.move_to(world.base)  # 自动卸货、回血
    return robot.gather(world.nearest_resource(robot))


def scout(robot, world, memory):
    # Scout：快速采集。也可以指定 world.resources 中某个 id 的资源。
    return collect(robot, world)


def guard(robot, world, memory):
    # Guard：敌人靠近时追击，否则沿自己的路线巡逻。
    if robot.hp < 50:
        return robot.move_to(world.base)
    enemy = world.nearest_enemy(robot)
    if enemy and robot.distance_to(enemy) < 160:
        return robot.attack(enemy)
    # 修改这些坐标，就能改变这台机器人的轨迹。
    route = [(360, 240), (540, 240), (540, 400), (360, 400)]
    return robot.follow(route, memory)


def hauler(robot, world, memory):
    # Hauler：大容量运输。可以换成自己的选矿与返航条件。
    return collect(robot, world)
`;
export const JAVASCRIPT = `// 每 0.2 秒模拟时间决策；三台机器人拥有独立 memory。
function collect(robot, world) {
    if (robot.cargoSlots >= robot.capacity || robot.hp < robot.maxHp * 0.3)
        return robot.move_to(world.base);
    return robot.gather(world.nearest_resource(robot));
}

function scout(robot, world, memory) {
    return collect(robot, world);
}

function guard(robot, world, memory) {
    if (robot.hp < 50) return robot.move_to(world.base);
    const enemy = world.nearest_enemy(robot);
    if (enemy && robot.distance_to(enemy) < 160) return robot.attack(enemy);
    const route = [[360, 240], [540, 240], [540, 400], [360, 400]];
    return robot.follow(route, memory);
}

function hauler(robot, world, memory) {
    return collect(robot, world);
}
`;
