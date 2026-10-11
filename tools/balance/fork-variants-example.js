// Variants for fork.py: each gets the save state S (a plain object, same shape as the saved game) and changes it.
// Ideas: give a price step for free, move a robot to another task, add bees, take away a shaft.
{
  base: S => {},
  'alloy +1': S => { S.lv.ingotGrade = (S.lv.ingotGrade | 0) + 1; },
  'labels +1': S => { S.lv.honeyPrice = (S.lv.honeyPrice | 0) + 1; },
  'hotter furnace +1': S => { S.lv.smeltSpeed = (S.lv.smeltSpeed | 0) + 1; },
  'robot 5 mines -> packs': S => { const c = S.robots[5]; if (c){ c.prio = [['bag', 'jar'], ['leaves']]; c.off = ['mine', 'smelt', 'haul']; c.miner = null; } },
  '+5 bees': S => { S.hive.bees += 5; },
}
