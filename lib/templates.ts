export const PYTHON = `# 目标：收集能源，满载后运回基地
# 每次调用控制三台机器人。点击右上角「手册」查看 API。
def decide(observation, memory):
    actions = {}
    base = observation["base"]
    resources = observation["resources"]

    for robot in observation["robots"]:
        if not robot["alive"]:
            continue

        # 满载或受伤时返回基地
        if (robot["cargo"] >= robot["capacity"]
                or robot["hp"] < robot["maxHp"] * 0.3):
            actions[robot["id"]] = {
                "type": "move", "x": base["x"], "y": base["y"]
            }
        elif resources:
            target = min(resources, key=lambda r:
                (r["x"] - robot["x"]) ** 2
                + (r["y"] - robot["y"]) ** 2)
            actions[robot["id"]] = {
                "type": "gather", "target_id": target["id"]
            }
        else:
            actions[robot["id"]] = {
                "type": "move", "x": base["x"], "y": base["y"]
            }

    return actions, memory
`;
export const JAVASCRIPT = `// 每次返回 [actions, memory]，字段与 Python 相同。
function decide(observation, memory) {
  const actions = {};
  const { base, resources, robots } = observation;
  for (const robot of robots) {
    if (!robot.alive) continue;
    if (robot.cargo >= robot.capacity || robot.hp < robot.maxHp * 0.3) {
      actions[robot.id] = { type: "move", ...base };
    } else if (resources.length) {
      const target = [...resources].sort((a, b) =>
        Math.hypot(a.x - robot.x, a.y - robot.y) -
        Math.hypot(b.x - robot.x, b.y - robot.y))[0];
      actions[robot.id] = { type: "gather", target_id: target.id };
    } else {
      actions[robot.id] = { type: "move", ...base };
    }
  }
  return [actions, memory];
}
`;
