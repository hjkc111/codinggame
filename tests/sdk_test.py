import unittest
from pathlib import Path

class SDKTest(unittest.TestCase):
    def setUp(self):
        self.scope = {}
        exec(Path('public/sdk.py').read_text(encoding='utf-8'), self.scope)

    def test_route_loop_and_stop(self):
        robot = self.scope['Robot'](x=10, y=10)
        memory = {}
        self.assertEqual(robot.follow([(10,10),(100,100)], memory), {'type':'move','x':100,'y':100})
        robot.update(x=100, y=100)
        self.assertEqual(robot.follow([(10,10),(100,100)], memory)['x'], 10)
        memory['route'] = 1
        self.assertEqual(robot.follow([(10,10),(100,100)], memory, loop=False)['x'], 100)
        self.assertEqual(robot.follow([], memory), {'type':'idle'})

    def test_dispatch_separates_memory_and_roles(self):
        for role in ['scout','guard','hauler']:
            exec(f'def {role}(r,w,m):\n    m["calls"] = m.get("calls",0)+1\n    return r.move_to(m["calls"], 100)', self.scope)
        obs={'base':{'x':0,'y':0},'enemies':[],'resources':[], 'robots':[{'id':str(i),'role':r,'alive':True,'x':0,'y':0} for i,r in enumerate(['Scout','Guard','Hauler'])]}
        actions,memory=self.scope['_dispatch'](obs,{})
        self.assertEqual([a['x'] for a in actions.values()],[1,1,1])
        self.assertEqual(memory, {str(i):{'calls':1} for i in range(3)})
        actions,memory=self.scope['_dispatch'](obs,memory)
        self.assertEqual([a['x'] for a in actions.values()],[2,2,2])
        world=self.scope['World'](obs)
        self.assertIsNone(world.nearest_resource(world.robots[0]))
        self.assertEqual(world.robots[0].gather(None),{'type':'idle'})

if __name__ == '__main__':
    unittest.main()
