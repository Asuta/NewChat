export const SEVEN_DAY_CROWN_PLAYER_PROFILE_ID = 'seven-day-crown-player-v1';
export const SEVEN_DAY_CROWN_ELENA_PROFILE_ID = 'seven-day-crown-elena-v1';
export const SEVEN_DAY_CROWN_HOLLOW_KNIGHT_PROFILE_ID = 'seven-day-crown-hollow-knight-v1';

export function getSevenDayCrownPlayerStats() {
  return {
    level: 1,
    strength: 16,
    strengthMod: 3,
    dexterity: 14,
    dexterityMod: 2,
    constitution: 14,
    constitutionMod: 2,
    intelligence: 10,
    intelligenceMod: 0,
    wisdom: 12,
    wisdomMod: 1,
    charisma: 10,
    charismaMod: 0,
    proficiencyBonus: 2,
    armorClass: 14,
    ac: 14,
    maxHitPoints: 12,
    currentHitPoints: 12,
    speed: 30,
    initiativeBonus: 2,
    passivePerception: 11,
    ironSwordAttackBonus: 5,
    ironSwordDamageBonus: 3,
    ironSwordDamageDice: '1d8',
    ironSwordVersatileDamageDice: '1d10',
    ironSwordDamageType: 'slashing',
  };
}

export function getSevenDayCrownElenaStats() {
  return {
    level: 3,
    strength: 14,
    strengthMod: 2,
    dexterity: 12,
    dexterityMod: 1,
    constitution: 14,
    constitutionMod: 2,
    intelligence: 10,
    intelligenceMod: 0,
    wisdom: 13,
    wisdomMod: 1,
    charisma: 12,
    charismaMod: 1,
    proficiencyBonus: 2,
    armorClass: 16,
    maxHitPoints: 22,
    currentHitPoints: 22,
    speed: 30,
    initiativeBonus: 1,
    passivePerception: 13,
  };
}

export function getSevenDayCrownHollowKnightStats() {
  return {
    level: 2,
    strength: 15,
    strengthMod: 2,
    dexterity: 10,
    dexterityMod: 0,
    constitution: 13,
    constitutionMod: 1,
    intelligence: 6,
    intelligenceMod: -2,
    wisdom: 8,
    wisdomMod: -1,
    charisma: 5,
    charismaMod: -3,
    proficiencyBonus: 2,
    armorClass: 15,
    maxHitPoints: 18,
    currentHitPoints: 18,
    speed: 25,
    initiativeBonus: 0,
    passivePerception: 9,
  };
}

export function seedSevenDayCrownWorld(api) {
  const {
    upsertEntity,
    setAliases,
    upsertComponent,
    upsertRelationship,
    setMeta,
    addEvent,
  } = api;

  const entities = [
    ['player', 'player', '失忆王选者'],
    ['scene_ash_chapel', 'scene', '灰烬礼拜堂'],
    ['scene_outer_gate', 'scene', '王都外门'],
    ['scene_registry', 'scene', '白鸦登记所'],
    ['scene_knight_hall', 'scene', '骑士团大厅'],
    ['scene_sanctum', 'scene', '地下圣库'],
    ['scene_people_theater', 'scene', '旧剧场议会'],
    ['scene_blackstone_tomb', 'scene', '黑石陵墓'],
    ['scene_mirror_archive', 'scene', '镜湖档案室'],
    ['scene_crown_hall', 'scene', '王冠厅'],
    ['character_elena', 'character', '艾蕾娜'],
    ['character_rowan', 'character', '罗文'],
    ['character_milo', 'character', '米洛'],
    ['character_aldric', 'character', '狮心公爵阿德里克'],
    ['character_eve', 'character', '圣女伊芙'],
    ['character_kaen', 'character', '灰街卡恩'],
    ['character_hollow_knight', 'character', '空壳骑士'],
    ['character_crown_will', 'character', '王冠意志'],
    ['item_crown_mark', 'item', '王冠印记'],
    ['item_iron_sword', 'item', '礼拜堂铁剑'],
    ['item_knight_oath', 'item', '骑士团誓约印'],
    ['item_church_oath', 'item', '教会誓约印'],
    ['item_people_oath', 'item', '民众誓约印'],
    ['item_blackstone_plaque', 'item', '黑石棺铭牌'],
    ['item_old_king_testament', 'item', '旧王遗诏'],
    ['item_forbidden_codex', 'item', '圣库禁书'],
    ['item_memory_vial', 'item', '空白记忆瓶'],
    ['item_broken_crown_shard', 'item', '破损王冠碎片'],
    ['faction_knights', 'faction', '白狮骑士团'],
    ['faction_church', 'faction', '圣冠教会'],
    ['faction_assembly', 'faction', '灰街民众议会'],
    ['faction_crown', 'faction', '王冠意志'],
    ['lore_royal_selection', 'lore', '王选制度'],
    ['lore_memory_crown', 'lore', '记忆王冠'],
    ['lore_blackstone_plan', 'lore', '黑石棺计划'],
    ['lore_seven_day_countdown', 'lore', '七日倒计时'],
    ['lore_dead_king', 'lore', '旧王之死'],
    ['quest_main', 'quest', '主线：七日王冠'],
    ['quest_knight_oath', 'quest', '取得骑士团誓约印'],
    ['quest_church_oath', 'quest', '取得教会誓约印'],
    ['quest_people_oath', 'quest', '取得民众誓约印'],
    ['quest_identity', 'quest', '找回玩家身份'],
    ['quest_final_choice', 'quest', '决定王冠命运'],
  ];

  for (const [id, kind, name] of entities) upsertEntity(id, kind, name);

  const aliases = {
    player: ['玩家', '殿下', '第四王选者', '无记忆继承者'],
    character_elena: ['女骑士', 'Elena', '艾蕾娜爵士'],
    character_rowan: ['掌玺官', 'Rowan'],
    character_milo: ['白鸦书记', 'Milo'],
    character_aldric: ['阿德里克', '狮心公爵', '第一王选者'],
    character_eve: ['伊芙', '圣女', '第二王选者'],
    character_kaen: ['卡恩', '灰街领袖', '第三王选者'],
    item_iron_sword: ['铁剑', '长剑', 'Iron Sword'],
    item_crown_mark: ['王选印记', '手背印记'],
  };
  for (const [entityId, names] of Object.entries(aliases)) setAliases(entityId, names);

  const components = [
    ['player', 'identity', {
      role: '失忆王选者',
      description: '玩家从灰烬礼拜堂的黑石棺中醒来，手背带着发光的王冠印记。玩家是本不该存在的第四王选者，也是上一任国王留下的秘密计划核心。',
      class: 'fighter',
      level: 1,
      campaignRole: 'protagonist',
    }],
    ['player', 'stats', getSevenDayCrownPlayerStats()],
    ['player', 'status', {
      state: 'healthy',
      label: '刚刚苏醒',
      description: '玩家刚从黑石棺中醒来，失去大部分记忆，但身体仍能行动。距离王冠仪式还有七天。',
      canAct: true,
    }],
    ['player', 'inventory', { items: ['item_crown_mark', 'item_iron_sword'], equippedWeaponId: 'item_iron_sword' }],
    ['scene_ash_chapel', 'scene', {
      description: '一座被焚毁的礼拜堂，焦黑长椅间散落着白色鸦羽。中央黑石棺已经打开，玩家就在这里醒来。这里是主线开场点，适合触发艾蕾娜说明“七天后王冠仪式”的引导。',
      exits: ['scene_outer_gate'], tags: ['开场', '遗迹', '安全点'], visibility: 'public',
    }],
    ['scene_outer_gate', 'scene', {
      description: '王都外门挤满士兵、难民和传令官。城墙上贴着王选告示：七日后，王冠将在王冠厅选择继承者。这里连接三条誓约印主线。',
      exits: ['scene_ash_chapel', 'scene_registry', 'scene_knight_hall', 'scene_sanctum', 'scene_people_theater'], tags: ['枢纽', '王都', '引导'], visibility: 'public',
    }],
    ['scene_registry', 'scene', {
      description: '白鸦登记所保存王选者、贵族血统和离奇死亡记录。掌玺官罗文在这里解释王选规则：玩家需要骑士团、教会、民众议会三枚誓约印。',
      exits: ['scene_outer_gate', 'scene_mirror_archive'], tags: ['档案', '规则说明', '主线第一站'], visibility: 'public',
    }],
    ['scene_knight_hall', 'scene', {
      description: '白狮骑士团大厅陈列着历代守誓者的盾牌。骑士团质疑玩家“死而复生”的资格，并要求玩家调查失踪骑士或通过试炼。',
      exits: ['scene_outer_gate', 'scene_blackstone_tomb'], tags: ['骑士团', '战斗试炼', '誓约印'], visibility: 'public',
    }],
    ['scene_sanctum', 'scene', {
      description: '地下圣库位于圣冠教会深处，墙上刻满加冕祷文。禁书记录显示，历代国王登基后都会逐渐失去原本的人格。',
      exits: ['scene_outer_gate', 'scene_mirror_archive'], tags: ['教会', '禁书', '真相'], visibility: 'restricted',
    }],
    ['scene_people_theater', 'scene', {
      description: '废弃旧剧场被灰街民众议会改成集会所。民众拒绝新王，但粮仓纵火案会迫使他们重新评估玩家。',
      exits: ['scene_outer_gate'], tags: ['民众议会', '交涉', '暴动'], visibility: 'public',
    }],
    ['scene_blackstone_tomb', 'scene', {
      description: '黑石陵墓埋葬着不被承认的王族实验品。黑石棺铭牌和旧王遗诏都指向玩家的真实身份：无记忆继承者。',
      exits: ['scene_knight_hall', 'scene_mirror_archive', 'scene_crown_hall'], tags: ['身份真相', '陵墓', '第六天'], visibility: 'hidden',
    }],
    ['scene_mirror_archive', 'scene', {
      description: '镜湖档案室的水面能显现被王冠吞噬的记忆。这里用于补足玩家错过的关键线索，并引导最终进入王冠厅。',
      exits: ['scene_registry', 'scene_sanctum', 'scene_blackstone_tomb'], tags: ['记忆', '线索补救', '梦境'], visibility: 'restricted',
    }],
    ['scene_crown_hall', 'scene', {
      description: '王冠厅是七日倒计时终点。三枚誓约印会打开记忆王座，王冠意志将在这里要求玩家继承、摧毁或改写王冠。',
      exits: ['scene_blackstone_tomb'], tags: ['最终幕', '王冠仪式', '抉择'], visibility: 'locked',
    }],
    ['character_elena', 'identity', {
      role: '女骑士与引导者',
      description: '艾蕾娜是白狮骑士团的年轻骑士，奉旧王密令守在灰烬礼拜堂。她称玩家为殿下，负责解释当前目标，并在玩家迷路时温和提醒下一步。',
      personality: ['忠诚', '克制', '会自责'],
      background: '她相信护送玩家登上王位是自己的使命，但会在发现王冠真相后动摇。',
    }],
    ['character_elena', 'status', { state: 'healthy', label: '警戒', description: '艾蕾娜守在玩家身边，警惕追兵靠近。', canAct: true }],
    ['character_elena', 'stats', getSevenDayCrownElenaStats()],
    ['character_rowan', 'identity', { role: '掌玺官', description: '罗文负责登记王选资格，是最适合解释主线规则的 NPC。他不忠于任何王选者，只忠于程序和印章。', personality: ['冷静', '守规矩', '不轻易表态'], background: '他知道玩家是第四王选者，但不知道黑石棺计划全貌。' }],
    ['character_rowan', 'status', { state: 'active', label: '办公中', description: '罗文在白鸦登记所整理王选档案。', canAct: true }],
    ['character_milo', 'identity', { role: '白鸦书记', description: '米洛是登记所的年轻书记，擅长从档案缝隙里找线索。他可以帮玩家查血统、死亡记录和禁书索引，但总会惹出小麻烦。', personality: ['机灵', '话多', '怕死但好奇'] }],
    ['character_milo', 'status', { state: 'active', label: '紧张', description: '米洛正在试图把一叠不该出现的旧王档案藏进袖子里。', canAct: true }],
    ['character_aldric', 'identity', { role: '第一王选者', description: '狮心公爵阿德里克代表秩序和武力。他相信王国需要强硬的新王，因此把玩家视作危险的不稳定因素。', personality: ['强硬', '骄傲', '重视荣誉'] }],
    ['character_aldric', 'status', { state: 'active', label: '备战', description: '阿德里克正在争取骑士团支持。', canAct: true }],
    ['character_eve', 'identity', { role: '第二王选者', description: '圣女伊芙代表圣冠教会。她相信王冠是神圣遗物，但地下圣库的禁书会动摇她的信仰。', personality: ['温和', '虔诚', '害怕真相'] }],
    ['character_eve', 'status', { state: 'active', label: '祈祷', description: '伊芙正在圣冠教会为王冠仪式祈祷。', canAct: true }],
    ['character_kaen', 'identity', { role: '第三王选者', description: '灰街卡恩代表民众议会。他不想继承王冠，而想摧毁王选制度本身。', personality: ['尖锐', '务实', '保护弱者'] }],
    ['character_kaen', 'status', { state: 'active', label: '煽动集会', description: '卡恩在旧剧场组织民众议会，准备反对任何新王。', canAct: true }],
    ['character_hollow_knight', 'identity', { role: '王冠受害者', description: '一名被王冠夺走记忆的骑士，只剩守卫命令。玩家第一次见到他时，应意识到王冠会吞噬人格。', personality: ['空洞', '机械', '偶尔痛苦'] }],
    ['character_hollow_knight', 'status', { state: 'hostile', label: '记忆空壳', description: '空壳骑士会阻止未经认可的人靠近黑石陵墓。', canAct: true }],
    ['character_hollow_knight', 'stats', getSevenDayCrownHollowKnightStats()],
    ['character_crown_will', 'identity', { role: '最终敌人与诱惑者', description: '王冠意志由历代国王残留记忆聚合而成。它会在梦境中温柔诱导玩家戴上王冠，声称可以归还全部记忆。', personality: ['温柔', '古老', '占有欲强'], background: '它不是单纯怪物，而是王国数百年秩序与牺牲的集合。' }],
    ['character_crown_will', 'status', { state: 'dormant', label: '沉睡', description: '王冠意志仍在沉睡，只能通过梦境和印记影响玩家。', canAct: false }],
    ['item_crown_mark', 'identity', { role: 'key_item', description: '玩家手背上的发光王冠印记。它证明玩家拥有王选资格，也会在玩家迷路时以刺痛、发光或梦境方式指向下一条主线线索。', effect: { type: 'quest_guidance', targetQuestId: 'quest_main' } }],
    ['item_iron_sword', 'identity', { role: 'weapon', description: '灰烬礼拜堂中拾得的旧铁剑，剑柄刻着白狮纹章。适合低等级近战判定。', weaponCategory: 'martial melee weapon', damageDice: '1d8', versatileDamageDice: '1d10', damageType: 'slashing', attackAbility: 'strength', proficient: true }],
    ['item_knight_oath', 'identity', { role: 'quest_token', description: '白狮骑士团的誓约印。获得它代表骑士团承认玩家有资格进入王冠厅。', effect: { type: 'unlock', targetEntityId: 'scene_crown_hall' } }],
    ['item_church_oath', 'identity', { role: 'quest_token', description: '圣冠教会的誓约印。它可以来自正式赐予、温和派协助，或玩家揭露禁书真相后的替代仪式。', effect: { type: 'unlock', targetEntityId: 'scene_crown_hall' } }],
    ['item_people_oath', 'identity', { role: 'quest_token', description: '民众议会的誓约印。它不是贵族印章，而是一枚刻满灰街名字的铜片。', effect: { type: 'unlock', targetEntityId: 'scene_crown_hall' } }],
    ['item_blackstone_plaque', 'identity', { role: 'clue', description: '黑石棺上的铭牌，写着“无记忆者承王冠之重，仍保自由之心”。它指向玩家并非普通王族。' }],
    ['item_old_king_testament', 'identity', { role: 'clue', description: '上一任国王留下的遗诏，承认王冠会吞噬继承者，并请求玩家在第七日作出真正选择。' }],
    ['item_forbidden_codex', 'identity', { role: 'clue', description: '圣库禁书，记录历代国王登基后人格逐渐被王冠覆盖的案例。' }],
    ['item_memory_vial', 'identity', { role: 'clue', description: '一只空白记忆瓶，能短暂保存被王冠剥离的记忆片段。可用于揭示空壳骑士的过去。' }],
    ['item_broken_crown_shard', 'identity', { role: 'final_choice_key', description: '旧王从王冠上敲下的碎片。最终幕可用它尝试摧毁或改写王冠。' }],
    ['faction_knights', 'identity', { role: 'faction', description: '白狮骑士团掌握武力与城防。他们重视秩序、荣誉和明确继承，但内部有人怀疑王冠。', goal: '确认谁能稳定王国。' }],
    ['faction_church', 'identity', { role: 'faction', description: '圣冠教会维护王冠神圣性，长期隐瞒王冠吞噬记忆的真相。', goal: '让王冠仪式按传统完成。' }],
    ['faction_assembly', 'identity', { role: 'faction', description: '灰街民众议会由贫民、工匠和退役士兵组成。他们反对王选制度，但也害怕王都陷入内战。', goal: '阻止另一个吞噬民众的王诞生。' }],
    ['faction_crown', 'identity', { role: 'ancient_will', description: '王冠意志代表历代君王记忆形成的集合意识。它承诺秩序、记忆与统一，代价是继承者的自我。', goal: '让玩家戴上王冠并成为新的容器。' }],
    ['lore_royal_selection', 'identity', { role: 'campaign_lore', description: '王选制度规定：王冠仪式前，王选者必须取得骑士团、教会、民众议会三枚誓约印，才可进入王冠厅。' }],
    ['lore_memory_crown', 'identity', { role: 'campaign_lore', description: '记忆王冠并非普通王权象征。它保存历代国王记忆，并会逐渐覆盖新王人格。' }],
    ['lore_blackstone_plan', 'identity', { role: 'campaign_lore', description: '黑石棺计划是旧王为了对抗王冠而留下的秘密方案：制造一个无记忆继承者，让其承受王冠记忆却保留自由意志。' }],
    ['lore_seven_day_countdown', 'identity', { role: 'campaign_lore', description: '距离王冠仪式只有七天。DM 应在每个阶段提醒剩余时间、已获得的誓约印和当前最清晰的下一步目标。' }],
    ['lore_dead_king', 'identity', { role: 'campaign_lore', description: '旧王已经死亡，但消息被封锁。各派系都在利用这七天争取继承结果。' }],
    ['quest_main', 'quest', { status: 'active', title: '七日王冠', description: '在七天内取得三枚誓约印，找回自己的身份，并在王冠仪式上决定王冠命运。', objectives: [{ text: '进入王都并了解王选规则', status: 'active' }, { text: '取得骑士团誓约印', status: 'pending' }, { text: '取得教会誓约印', status: 'pending' }, { text: '取得民众誓约印', status: 'pending' }, { text: '查明黑石棺计划和玩家身份', status: 'hidden' }, { text: '在第七日进入王冠厅作出最终选择', status: 'locked' }], currentGuidance: '从灰烬礼拜堂醒来后，先听艾蕾娜说明情况，再前往王都外门与白鸦登记所。' }],
    ['quest_knight_oath', 'quest', { status: 'active', phaseStatus: 'available', title: '取得骑士团誓约印', description: '调查失踪骑士或通过骑士团试炼，证明玩家不是被王冠操控的空壳。', nextSceneId: 'scene_knight_hall' }],
    ['quest_church_oath', 'quest', { status: 'active', phaseStatus: 'available', title: '取得教会誓约印', description: '进入地下圣库，找到教会隐瞒王冠真相的证据，并决定如何面对圣女伊芙。', nextSceneId: 'scene_sanctum' }],
    ['quest_people_oath', 'quest', { status: 'active', phaseStatus: 'available', title: '取得民众誓约印', description: '调查粮仓纵火阴谋，让灰街民众议会相信玩家不会成为下一个吞噬他们的王。', nextSceneId: 'scene_people_theater' }],
    ['quest_identity', 'quest', { status: 'inactive', phaseStatus: 'hidden', title: '找回玩家身份', description: '通过黑石棺铭牌、旧王遗诏、镜湖档案室和空白记忆瓶查明玩家是无记忆继承者。', nextSceneId: 'scene_blackstone_tomb' }],
    ['quest_final_choice', 'quest', { status: 'inactive', phaseStatus: 'locked', title: '决定王冠命运', description: '在第七日进入王冠厅，选择继承、摧毁、改写、封印或让出王冠。', nextSceneId: 'scene_crown_hall' }],
  ];
  for (const [entityId, type, data] of components) upsertComponent(entityId, type, data);

  const relationships = [
    ['player', 'scene_ash_chapel', 'located_in', null, '玩家在灰烬礼拜堂的黑石棺中醒来。'],
    ['character_elena', 'scene_ash_chapel', 'located_in', null, '艾蕾娜守在玩家醒来的礼拜堂中，是开场引导者。'],
    ['character_rowan', 'scene_registry', 'located_in', null, '掌玺官罗文在白鸦登记所解释王选规则。'],
    ['character_milo', 'scene_registry', 'located_in', null, '米洛在白鸦登记所协助查档案。'],
    ['character_aldric', 'scene_knight_hall', 'located_in', null, '狮心公爵正在骑士团大厅争取骑士团誓约印。'],
    ['character_eve', 'scene_sanctum', 'located_in', null, '圣女伊芙在地下圣库附近祈祷，守护教会誓约印。'],
    ['character_kaen', 'scene_people_theater', 'located_in', null, '灰街卡恩在旧剧场议会组织民众。'],
    ['character_hollow_knight', 'scene_blackstone_tomb', 'located_in', null, '空壳骑士守在黑石陵墓，是王冠吞噬记忆的活证据。'],
    ['character_crown_will', 'scene_crown_hall', 'located_in', null, '王冠意志沉睡在王冠厅，等待第七日仪式。'],
    ['player', 'item_crown_mark', 'ownership', null, '玩家手背带着王冠印记。'],
    ['player', 'item_iron_sword', 'ownership', null, '玩家从灰烬礼拜堂拾得一把旧铁剑。'],
    ['scene_ash_chapel', 'item_blackstone_plaque', 'mentions', null, '灰烬礼拜堂的黑石棺上刻着铭牌。'],
    ['scene_sanctum', 'item_forbidden_codex', 'mentions', null, '地下圣库藏有记录王冠真相的禁书。'],
    ['scene_blackstone_tomb', 'item_old_king_testament', 'mentions', null, '黑石陵墓中藏着旧王遗诏。'],
    ['scene_mirror_archive', 'item_memory_vial', 'mentions', null, '镜湖档案室可以找到空白记忆瓶。'],
    ['scene_crown_hall', 'item_broken_crown_shard', 'mentions', null, '王冠厅里隐藏着破损王冠碎片，能影响最终选择。'],
    ['scene_ash_chapel', 'scene_outer_gate', 'exit_to', null, '礼拜堂废墟外的小路通往王都外门。'],
    ['scene_outer_gate', 'scene_ash_chapel', 'exit_to', null, '从王都外门可以返回灰烬礼拜堂。'],
    ['scene_outer_gate', 'scene_registry', 'exit_to', null, '王都外门内侧的大道通往白鸦登记所。'],
    ['scene_registry', 'scene_outer_gate', 'exit_to', null, '白鸦登记所门前道路返回王都外门。'],
    ['scene_outer_gate', 'scene_knight_hall', 'exit_to', null, '王都北侧阶梯通往白狮骑士团大厅。'],
    ['scene_knight_hall', 'scene_outer_gate', 'exit_to', null, '骑士团大厅外的阶梯返回王都外门。'],
    ['scene_outer_gate', 'scene_sanctum', 'exit_to', null, '王都东侧圣冠教会的地下门通往圣库。'],
    ['scene_sanctum', 'scene_outer_gate', 'exit_to', null, '圣库石阶返回王都外门。'],
    ['scene_outer_gate', 'scene_people_theater', 'exit_to', null, '灰街巷道通往旧剧场议会。'],
    ['scene_people_theater', 'scene_outer_gate', 'exit_to', null, '旧剧场后门返回王都外门。'],
    ['scene_registry', 'scene_mirror_archive', 'exit_to', null, '登记所密档梯通往镜湖档案室。'],
    ['scene_mirror_archive', 'scene_registry', 'exit_to', null, '镜湖档案室可以返回白鸦登记所。'],
    ['scene_sanctum', 'scene_mirror_archive', 'exit_to', null, '圣库禁门后也能进入镜湖档案室。'],
    ['scene_mirror_archive', 'scene_sanctum', 'exit_to', null, '镜湖档案室的圣冠门返回地下圣库。'],
    ['scene_knight_hall', 'scene_blackstone_tomb', 'exit_to', null, '骑士团地下试炼道通往黑石陵墓。'],
    ['scene_blackstone_tomb', 'scene_knight_hall', 'exit_to', null, '黑石陵墓的旧阶梯返回骑士团大厅。'],
    ['scene_mirror_archive', 'scene_blackstone_tomb', 'exit_to', null, '镜湖深处的倒影门通往黑石陵墓。'],
    ['scene_blackstone_tomb', 'scene_mirror_archive', 'exit_to', null, '黑石陵墓中的水镜可返回镜湖档案室。'],
    ['scene_blackstone_tomb', 'scene_crown_hall', 'exit_to', null, '集齐三枚誓约印后，黑石陵墓深处的王道会开启，通往王冠厅。'],
    ['scene_crown_hall', 'scene_blackstone_tomb', 'exit_to', null, '王冠厅仪式结束后可返回黑石陵墓。'],
    ['character_elena', 'player', 'trust', 45, '艾蕾娜忠于玩家，但仍在确认玩家是否会被王冠吞噬。'],
    ['character_elena', 'faction_knights', 'belongs_to', null, '艾蕾娜属于白狮骑士团。'],
    ['character_aldric', 'faction_knights', 'belongs_to', null, '狮心公爵获得许多骑士支持。'],
    ['character_eve', 'faction_church', 'belongs_to', null, '圣女伊芙代表圣冠教会。'],
    ['character_kaen', 'faction_assembly', 'belongs_to', null, '灰街卡恩代表民众议会。'],
    ['character_crown_will', 'faction_crown', 'belongs_to', null, '王冠意志就是王冠派系的核心。'],
    ['quest_main', 'lore_seven_day_countdown', 'requires', null, '主线推进依赖七日倒计时。'],
    ['quest_main', 'quest_knight_oath', 'requires', null, '完成主线需要取得骑士团誓约印。'],
    ['quest_main', 'quest_church_oath', 'requires', null, '完成主线需要取得教会誓约印。'],
    ['quest_main', 'quest_people_oath', 'requires', null, '完成主线需要取得民众誓约印。'],
    ['quest_main', 'quest_identity', 'requires', null, '完成主线需要查明玩家身份。'],
    ['quest_final_choice', 'scene_crown_hall', 'requires', null, '最终选择发生在王冠厅。'],
    ['scene_registry', 'lore_royal_selection', 'mentions', null, '白鸦登记所可以解释王选制度。'],
    ['scene_sanctum', 'lore_memory_crown', 'mentions', null, '地下圣库揭示记忆王冠真相。'],
    ['scene_blackstone_tomb', 'lore_blackstone_plan', 'mentions', null, '黑石陵墓揭示黑石棺计划。'],
    ['scene_registry', 'lore_dead_king', 'mentions', null, '登记所档案暗示旧王之死被封锁。'],
    ['character_rowan', 'lore_royal_selection', 'knows', null, '罗文可以向玩家解释三枚誓约印的规则。'],
    ['character_milo', 'lore_dead_king', 'knows', null, '米洛能查到旧王死亡记录中的矛盾。'],
    ['character_hollow_knight', 'lore_memory_crown', 'mentions', null, '空壳骑士是王冠吞噬记忆后的结果。'],
    ['character_crown_will', 'player', 'fear', 20, '王冠意志既渴望吞噬玩家，也害怕玩家保留自由意志。'],
  ];

  for (const [sourceId, targetId, type, value, summary] of relationships) {
    upsertRelationship(sourceId, targetId, type, value, { source: 'seed', summary });
  }

  setMeta('playerId', 'player');
  setMeta('currentSceneId', 'scene_ash_chapel');
  setMeta('campaignId', 'seven-day-crown');
  setMeta('campaignTitle', '七日王冠');
  setMeta('campaignDay', '1');
  addEvent('world.seeded', null, null, { summary: '初始化七日王冠默认游戏世界。' });
}

export function ensureSevenDayCrownPlayableState(api) {
  const {
    getEntity,
    upsertEntity,
    setAliases,
    mergeComponentDefaults,
    applyStatsProfile,
    mergeInventoryDefaults,
    upsertRelationship,
  } = api;

  if (getEntity('player')) {
    upsertEntity('item_iron_sword', 'item', '礼拜堂铁剑');
    upsertEntity('item_crown_mark', 'item', '王冠印记');
    setAliases('player', ['玩家', '殿下', '第四王选者', '无记忆继承者']);
    setAliases('item_iron_sword', ['铁剑', '长剑', 'Iron Sword']);
    mergeComponentDefaults('player', 'identity', {
      role: '失忆王选者',
      description: '玩家从灰烬礼拜堂的黑石棺中醒来，手背带着发光的王冠印记。',
      class: 'fighter',
      level: 1,
    });
    applyStatsProfile('player', getSevenDayCrownPlayerStats(), SEVEN_DAY_CROWN_PLAYER_PROFILE_ID, ['maxHitPoints', 'currentHitPoints']);
    mergeComponentDefaults('player', 'status', {
      state: 'healthy',
      label: '刚刚苏醒',
      description: '玩家刚从黑石棺中醒来，失去大部分记忆，但身体仍能行动。',
      canAct: true,
    });
    mergeInventoryDefaults('player', {
      items: ['item_crown_mark', 'item_iron_sword'],
      equippedWeaponId: 'item_iron_sword',
    });
    mergeComponentDefaults('item_iron_sword', 'identity', {
      role: 'weapon',
      description: '灰烬礼拜堂中拾得的旧铁剑，剑柄刻着白狮纹章。适合低等级近战判定。',
      weaponCategory: 'martial melee weapon',
      damageDice: '1d8',
      versatileDamageDice: '1d10',
      damageType: 'slashing',
      attackAbility: 'strength',
      proficient: true,
    });
    mergeComponentDefaults('item_crown_mark', 'identity', {
      role: 'key_item',
      description: '玩家手背上的发光王冠印记。它证明玩家拥有王选资格，也会在玩家迷路时指向下一条主线线索。',
      effect: { type: 'quest_guidance', targetQuestId: 'quest_main' },
    });
    upsertRelationship('player', 'item_crown_mark', 'ownership', null, { source: 'baseline', summary: '玩家手背带着王冠印记。' });
    upsertRelationship('player', 'item_iron_sword', 'ownership', null, { source: 'baseline', summary: '玩家从灰烬礼拜堂拾得一把旧铁剑。' });
  }

  if (getEntity('character_elena')) {
    applyStatsProfile('character_elena', getSevenDayCrownElenaStats(), SEVEN_DAY_CROWN_ELENA_PROFILE_ID, ['maxHitPoints', 'currentHitPoints']);
  }

  if (getEntity('character_hollow_knight')) {
    applyStatsProfile('character_hollow_knight', getSevenDayCrownHollowKnightStats(), SEVEN_DAY_CROWN_HOLLOW_KNIGHT_PROFILE_ID, ['maxHitPoints', 'currentHitPoints']);
  }
}
