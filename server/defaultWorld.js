export const MA_DASHUAI_PLAYER_PROFILE_ID = 'ma-dashuai-player-v1';
export const MA_DASHUAI_CAMPAIGN_ID = 'ma-dashuai-city-life';
export const MA_DASHUAI_YUFEN_PROFILE_ID = 'ma-dashuai-yufen-v1';
export const MA_DASHUAI_GANGZI_PROFILE_ID = 'ma-dashuai-gangzi-v1';

export const MA_DASHUAI_CHARACTER_HIT_POINTS = Object.freeze({
  character_yufen: 14,
  character_fan_debiao: 18,
  character_ma_xiaocui: 12,
  character_guiying: 14,
  character_wu: 16,
  character_awei: 12,
  character_yu_fugui: 16,
  character_gangzi: 20,
});

export function getMaDashuaiCharacterHitPointStats(entityId) {
  const maxHitPoints = MA_DASHUAI_CHARACTER_HIT_POINTS[entityId];
  if (!Number.isFinite(maxHitPoints)) {
    throw new Error(`Unknown Ma Dashuai character: ${entityId}`);
  }
  return { maxHitPoints, currentHitPoints: maxHitPoints };
}

export function getMaDashuaiPlayerStats() {
  return {
    level: 1,
    strength: 13,
    strengthMod: 1,
    dexterity: 10,
    dexterityMod: 0,
    constitution: 14,
    constitutionMod: 2,
    intelligence: 9,
    intelligenceMod: -1,
    wisdom: 14,
    wisdomMod: 2,
    charisma: 13,
    charismaMod: 1,
    proficiencyBonus: 2,
    armorClass: 11,
    ac: 11,
    maxHitPoints: 14,
    currentHitPoints: 14,
    speed: 30,
    initiativeBonus: 0,
    passivePerception: 12,
    woodenPoleAttackBonus: 3,
    woodenPoleDamageBonus: 1,
    woodenPoleDamageDice: '1d4',
    woodenPoleDamageType: 'bludgeoning',
  };
}

export function getMaDashuaiYufenStats() {
  return {
    level: 1,
    strength: 10,
    strengthMod: 0,
    dexterity: 11,
    dexterityMod: 0,
    constitution: 12,
    constitutionMod: 1,
    intelligence: 11,
    intelligenceMod: 0,
    wisdom: 15,
    wisdomMod: 2,
    charisma: 14,
    charismaMod: 2,
    proficiencyBonus: 2,
    armorClass: 10,
    ...getMaDashuaiCharacterHitPointStats('character_yufen'),
    speed: 30,
    initiativeBonus: 0,
    passivePerception: 12,
  };
}

export function getMaDashuaiGangziStats() {
  return {
    level: 2,
    strength: 15,
    strengthMod: 2,
    dexterity: 13,
    dexterityMod: 1,
    constitution: 14,
    constitutionMod: 2,
    intelligence: 10,
    intelligenceMod: 0,
    wisdom: 10,
    wisdomMod: 0,
    charisma: 11,
    charismaMod: 0,
    proficiencyBonus: 2,
    armorClass: 12,
    ...getMaDashuaiCharacterHitPointStats('character_gangzi'),
    speed: 30,
    initiativeBonus: 1,
    passivePerception: 10,
  };
}

export function seedMaDashuaiWorld(api) {
  const {
    upsertEntity,
    setAliases,
    upsertComponent,
    upsertRelationship,
    setMeta,
    addEvent,
  } = api;

  const entities = [
    ['player', 'player', '马大帅'],
    ['scene_bus_station', 'scene', '城市客运站'],
    ['scene_city_street', 'scene', '城里街面'],
    ['scene_victoria', 'scene', '维多利亚娱乐广场'],
    ['scene_guiying_restaurant', 'scene', '桂英饭店'],
    ['scene_construction_site', 'scene', '建筑工地'],
    ['scene_bathhouse', 'scene', '大众浴池'],
    ['scene_yufen_home', 'scene', '玉芬出租屋'],
    ['scene_majia_village', 'scene', '马家堡子'],
    ['scene_migrant_school', 'scene', '大帅打工子弟学校'],
    ['character_yufen', 'character', '王玉芬'],
    ['character_fan_debiao', 'character', '范德彪'],
    ['character_ma_xiaocui', 'character', '马小翠'],
    ['character_guiying', 'character', '桂英'],
    ['character_wu', 'character', '吴总'],
    ['character_awei', 'character', '阿薇'],
    ['character_yu_fugui', 'character', '余富贵'],
    ['character_gangzi', 'character', '钢子'],
    ['item_erhu', 'item', '旧二胡'],
    ['item_wooden_pole', 'item', '行李木棍'],
    ['item_honghua_oil', 'item', '红花油'],
    ['item_torn_address', 'item', '撕破的地址条'],
    ['item_victoria_badge', 'item', '维多利亚工作牌'],
    ['item_bridal_money_receipt', 'item', '三万元礼钱收据'],
    ['item_wage_envelope', 'item', '打工工资袋'],
    ['item_xiaocui_note', 'item', '小翠留下的纸条'],
    ['item_school_ledger', 'item', '学校收支账本'],
    ['item_train_ticket', 'item', '回乡车票'],
    ['item_debiao_business_card', 'item', '范德彪名片'],
    ['faction_ma_family', 'faction', '马家亲友'],
    ['faction_victoria', 'faction', '维多利亚关系网'],
    ['faction_villagers', 'faction', '马家堡子乡亲'],
    ['faction_workers', 'faction', '城里务工者'],
    ['lore_runaway_wedding', 'lore', '小翠逃婚'],
    ['lore_bridal_money', 'lore', '三万元礼钱'],
    ['lore_city_migrant_life', 'lore', '进城谋生'],
    ['lore_debiao_reputation', 'lore', '彪哥的名号'],
    ['lore_realism_tone', 'lore', '东北小人物现实喜剧'],
    ['quest_main', 'quest', '主线：马大帅进城'],
    ['quest_find_debiao', 'quest', '找到范德彪'],
    ['quest_find_xiaocui', 'quest', '找到马小翠'],
    ['quest_repay_bridal_money', 'quest', '挣回三万元礼钱'],
    ['quest_help_yufen', 'quest', '照应玉芬和乡亲'],
    ['quest_future_choice', 'quest', '决定一家人的去处'],
  ];

  for (const [id, kind, name] of entities) upsertEntity(id, kind, name);

  const aliases = {
    player: ['玩家', '老马', '大帅', '马叔', '马校长'],
    character_yufen: ['玉芬', '王玉芬'],
    character_fan_debiao: ['范德彪', '德彪', '彪哥', '辽北狠人'],
    character_ma_xiaocui: ['小翠', '马小翠'],
    character_guiying: ['桂英', '桂英老板'],
    character_wu: ['吴总', '吴老板'],
    character_awei: ['阿薇'],
    character_yu_fugui: ['余富贵', '余村长'],
    character_gangzi: ['钢子'],
    item_wooden_pole: ['木棍', '挑行李的木棍', '棍子'],
    item_erhu: ['二胡', '旧琴'],
    item_honghua_oil: ['药油', '红花油', '跌打药'],
  };
  for (const [entityId, names] of Object.entries(aliases)) setAliases(entityId, names);

  const components = [
    ['player', 'identity', {
      role: '进城寻找女儿的农民',
      description: '玩家扮演马大帅。小翠在婚礼当天逃进城里，马大帅为找女儿来到城里，却在长途车上丢了钱包和范德彪的地址。眼下他身无分文，但认准的事不会轻易放下。',
      class: 'civilian',
      level: 1,
      campaignRole: 'protagonist',
      personality: ['实在', '倔强', '心软', '爱面子', '肯吃苦'],
    }],
    ['player', 'stats', getMaDashuaiPlayerStats()],
    ['player', 'status', {
      state: 'healthy',
      label: '刚刚进城',
      description: '马大帅刚下长途车，钱包和地址都丢了，只剩随身行李和一把旧二胡。',
      canAct: true,
    }],
    ['player', 'inventory', { items: ['item_erhu', 'item_wooden_pole', 'item_honghua_oil'] }],
    ['scene_bus_station', 'scene', {
      description: '世纪之交的东北小城客运站，人声嘈杂，揽客声和喇叭声混在一起。马大帅刚发现钱包与地址不见了；玉芬也进城寻人，正好在站外碰见他。这里是故事开场。',
      exits: ['scene_city_street'], tags: ['开场', '客运站', '寻人'], visibility: 'public',
    }],
    ['scene_city_street', 'scene', {
      description: '城里街面连接车站、饭店、工地和维多利亚。招工广告真假难辨，外来务工者都在这里找活、问路，也最容易遇上误会与骗局。',
      exits: ['scene_bus_station', 'scene_victoria', 'scene_guiying_restaurant', 'scene_construction_site', 'scene_bathhouse', 'scene_yufen_home'], tags: ['枢纽', '城市', '务工'], visibility: 'public',
    }],
    ['scene_victoria', 'scene', {
      description: '维多利亚娱乐广场灯光耀眼，是吴总的生意，也是范德彪口中自己当“大保镖”的体面地方。小翠和阿薇都与这里有关，热闹背后藏着复杂的人情与利益。',
      exits: ['scene_city_street', 'scene_guiying_restaurant'], tags: ['维多利亚', '范德彪', '找小翠'], visibility: 'public',
    }],
    ['scene_guiying_restaurant', 'scene', {
      description: '桂英经营的小饭店不算气派，却是熟人落脚、打听消息和临时找活的地方。后厨缺人，桂英嘴硬心软，但最烦别人赊账和吹牛。',
      exits: ['scene_city_street', 'scene_victoria', 'scene_yufen_home'], tags: ['饭店', '打工', '熟人'], visibility: 'public',
    }],
    ['scene_construction_site', 'scene', {
      description: '尘土飞扬的建筑工地按天结工钱。活重、账乱，工头常拿“明天结账”搪塞人，是马大帅和乡亲们靠力气挣钱的地方。',
      exits: ['scene_city_street', 'scene_majia_village'], tags: ['工地', '挣钱', '欠薪'], visibility: 'public',
    }],
    ['scene_bathhouse', 'scene', {
      description: '大众浴池雾气腾腾，搓澡、看门、烧水都能换口饭吃。这里消息灵通，也可能接到一些看着来钱快、实际并不靠谱的活。',
      exits: ['scene_city_street'], tags: ['浴池', '零工', '市井'], visibility: 'public',
    }],
    ['scene_yufen_home', 'scene', {
      description: '玉芬租住的小屋不大，却常给马大帅和乡亲们留口热饭。这里适合谈家事、感情和下一步打算，也是马大帅在城里少有的安稳落脚处。',
      exits: ['scene_city_street', 'scene_guiying_restaurant'], tags: ['住处', '玉芬', '家庭'], visibility: 'restricted',
    }],
    ['scene_majia_village', 'scene', {
      description: '马家堡子是马大帅和小翠的老家。逃婚与三万元礼钱让马家和余家都下不来台，余富贵既要钱，也要给自己这个村长找回面子。',
      exits: ['scene_construction_site', 'scene_migrant_school'], tags: ['乡村', '余富贵', '礼钱'], visibility: 'public',
    }],
    ['scene_migrant_school', 'scene', {
      description: '由几间旧屋改成的打工子弟学校，是马大帅在城里经历诸多坎坷后可能走出的新路。学校缺钱、缺老师，也需要所有人决定是否愿意一起把它办下去。',
      exits: ['scene_majia_village'], tags: ['未来', '学校', '最终抉择'], visibility: 'locked',
    }],
    ['character_yufen', 'identity', {
      role: '同行者与生活支柱',
      description: '王玉芬为人朴实能干，对马大帅有感情，也比他更能看清眼前的难处。她会在客运站接应迷路的马大帅，并提醒他先活下来，再谈面子。',
      personality: ['善良', '能干', '有主见', '重感情'],
      background: '玉芬与前夫牛二留下不少伤痛，进城后一直努力过自己的日子。',
    }],
    ['character_yufen', 'status', { state: 'healthy', label: '找到了老马', description: '玉芬在客运站外认出了身无分文的马大帅，正准备带他去找范德彪。', canAct: true }],
    ['character_yufen', 'stats', getMaDashuaiYufenStats()],
    ['character_fan_debiao', 'identity', {
      role: '小舅子与城市向导',
      description: '范德彪是小翠的舅舅，在维多利亚给吴总当保镖，自称开原第一保镖和辽北地区著名狠人。他好面子、爱吹牛，但家里人真遇上事时通常不会撒手不管。',
      personality: ['爱面子', '能吹', '热心', '容易冲动'],
    }],
    ['character_fan_debiao', 'status', { state: 'active', label: '维持场面', description: '范德彪正在维多利亚门口维持秩序，努力让所有人都看见自己的派头。', canAct: true }],
    ['character_fan_debiao', 'stats', getMaDashuaiCharacterHitPointStats('character_fan_debiao')],
    ['character_ma_xiaocui', 'identity', {
      role: '马大帅的女儿',
      description: '马小翠不愿接受父亲安排的婚事，在婚礼当天逃进城投奔舅舅范德彪。她想自己选择工作和感情，不愿再被父亲替她做主。',
      personality: ['倔强', '独立', '心软', '敢闯'],
    }],
    ['character_ma_xiaocui', 'status', { state: 'active', label: '躲着父亲', description: '小翠暂时留在维多利亚附近，不知道该如何面对刚进城的父亲。', canAct: true }],
    ['character_ma_xiaocui', 'stats', getMaDashuaiCharacterHitPointStats('character_ma_xiaocui')],
    ['character_guiying', 'identity', {
      role: '饭店老板',
      description: '桂英经营饭店，嘴上不饶人，心里却惦记熟人。她对范德彪有好感，也清楚他那些名号有多少水分。',
      personality: ['爽快', '泼辣', '务实', '刀子嘴豆腐心'],
    }],
    ['character_guiying', 'status', { state: 'active', label: '饭口正忙', description: '桂英正在前厅后厨两头跑，缺一个肯干活又不偷懒的人。', canAct: true }],
    ['character_guiying', 'stats', getMaDashuaiCharacterHitPointStats('character_guiying')],
    ['character_wu', 'identity', {
      role: '维多利亚老板',
      description: '吴总经营维多利亚，见过场面，也习惯用生意人的方式处理麻烦。他欣赏小翠，对范德彪既使用又头疼。',
      personality: ['圆滑', '体面', '现实', '有控制欲'],
    }],
    ['character_wu', 'status', { state: 'active', label: '照看生意', description: '吴总在办公室处理维多利亚的账目和人情往来。', canAct: true }],
    ['character_wu', 'stats', getMaDashuaiCharacterHitPointStats('character_wu')],
    ['character_awei', 'identity', {
      role: '维多利亚工作人员',
      description: '阿薇在维多利亚工作，熟悉这里的人和事。范德彪对她有好感，但她并不愿意因为彪哥的自我感觉而迁就。',
      personality: ['清醒', '直接', '独立'],
    }],
    ['character_awei', 'status', { state: 'active', label: '准备上班', description: '阿薇正在后台准备工作，不想掺和范德彪新吹出来的麻烦。', canAct: true }],
    ['character_awei', 'stats', getMaDashuaiCharacterHitPointStats('character_awei')],
    ['character_yu_fugui', 'identity', {
      role: '马家堡子村长',
      description: '余富贵是余德财的父亲，也是马家堡子村长。小翠逃婚让余家丢了面子，他要求马大帅给出交代并归还三万元礼钱。',
      personality: ['好面子', '精明', '认死理', '顾村里评价'],
    }],
    ['character_yu_fugui', 'status', { state: 'active', label: '等个说法', description: '余富贵留在马家堡子等马大帅回来处理婚事和礼钱。', canAct: true }],
    ['character_yu_fugui', 'stats', getMaDashuaiCharacterHitPointStats('character_yu_fugui')],
    ['character_gangzi', 'identity', {
      role: '小翠的男朋友',
      description: '钢子是小翠在城里交往的男朋友，讲义气但身边常有复杂麻烦。马大帅需要判断他是否真心对待小翠，而不是只凭第一印象替女儿决定。',
      personality: ['讲义气', '冲动', '护短', '不服管'],
    }],
    ['character_gangzi', 'status', { state: 'active', label: '在街面周旋', description: '钢子正在城里街面处理一桩旧麻烦，不愿让小翠被牵连。', canAct: true }],
    ['character_gangzi', 'stats', getMaDashuaiGangziStats()],
    ['item_erhu', 'identity', { role: 'tool', description: '马大帅随身带来的旧二胡。手头没钱时可以到街边拉一段换些饭钱，也能用音乐让紧张场面缓下来。', effect: { type: 'narrative', targetQuestId: 'quest_main' } }],
    ['item_wooden_pole', 'identity', { role: 'weapon', description: '原本用来挑行李的结实木棍。平时是工具，真到保护自己或家人的时候也能当作临时武器。', weaponCategory: 'improvised melee weapon', damageDice: '1d4', versatileDamageDice: '1d6', damageType: 'bludgeoning', attackAbility: 'strength', proficient: true }],
    ['item_honghua_oil', 'identity', { role: 'consumable', description: '一小瓶红花油，干重活或挨碰以后抹一抹，能暂时缓和疼痛。' }],
    ['item_erhu', 'item', { category: 'tool', stackable: false, droppable: false, use: { type: 'narrative', target: 'optional_character', label: '拉一段二胡' } }],
    ['item_wooden_pole', 'item', { category: 'weapon', stackable: false, droppable: true }],
    ['item_honghua_oil', 'item', { category: 'consumable', stackable: true, droppable: true, use: { type: 'restore_hit_points', target: 'self_or_character', amount: 4, consumeQuantity: 1 } }],
    ['item_torn_address', 'identity', { role: 'clue', description: '从客运站长椅下面找到的半张地址，能辨认出“维多利亚”和范德彪名字的一部分。' }],
    ['item_victoria_badge', 'identity', { role: 'quest_token', description: '维多利亚的临时工作牌，代表吴总同意让马大帅在这里出入和干活。' }],
    ['item_bridal_money_receipt', 'identity', { role: 'clue', description: '余家交付三万元礼钱的收据。钱已经花掉一部分，但婚事作废后，这笔账必须有人面对。' }],
    ['item_wage_envelope', 'identity', { role: 'quest_token', description: '装着打工收入的工资袋。每一笔钱都来得不容易，可用于逐步偿还礼钱或帮助身边的人。' }],
    ['item_xiaocui_note', 'identity', { role: 'clue', description: '小翠逃婚前留下的纸条，写明她不是恨父亲，只是不愿意嫁给自己不喜欢的人。' }],
    ['item_school_ledger', 'identity', { role: 'final_choice_key', description: '打工子弟学校的收支账本。它记录的不是一笔生意，而是许多孩子能不能继续念书。' }],
    ['item_train_ticket', 'identity', { role: 'final_choice_key', description: '一张回马家堡子的车票。留下还是回乡，并不只是换个地方，也意味着选择怎样过往后的日子。' }],
    ['item_debiao_business_card', 'identity', { role: 'clue', description: '范德彪印得十分气派的名片，上面写着“开原第一保镖”，背面是维多利亚的地址。' }],
    ['faction_ma_family', 'identity', { role: 'faction', description: '马大帅、小翠、玉芬和范德彪构成的松散亲友圈。大家常争吵、误会，也总在真正出事时互相兜底。', goal: '让各自都能过上有尊严的日子。' }],
    ['faction_victoria', 'identity', { role: 'faction', description: '围绕维多利亚形成的老板、保镖、员工与社会关系。这里有机会、有体面，也有人情债和利益交换。', goal: '维持生意与场面。' }],
    ['faction_villagers', 'identity', { role: 'faction', description: '马家堡子的村民重视乡情、面子与承诺，不少人也想跟着进城挣钱。', goal: '在变化的日子里找到出路。' }],
    ['faction_workers', 'identity', { role: 'faction', description: '进城务工者靠零工和体力维持生活，最在意工钱能否结清、住处是否安稳以及彼此能否搭把手。', goal: '靠诚实劳动在城里站住脚。' }],
    ['lore_runaway_wedding', 'identity', { role: 'campaign_lore', description: '马大帅替女儿安排了与村长儿子余德财的婚事，小翠在婚礼当天逃进城里。故事不把她的逃婚当作错误，而是要求马大帅学会尊重女儿的选择。' }],
    ['lore_bridal_money', 'identity', { role: 'campaign_lore', description: '余家给出的三万元礼钱已经形成现实债务。马大帅决定靠打工把钱还上，为女儿解除婚约，也为自己的决定承担责任。' }],
    ['lore_city_migrant_life', 'identity', { role: 'campaign_lore', description: '故事发生在世纪之交的东北城乡。进城务工者会遇到欠薪、骗局、住房、医疗和子女上学等现实难题，解决问题主要依靠劳动、人情与选择。' }],
    ['lore_debiao_reputation', 'identity', { role: 'campaign_lore', description: '范德彪自称开原第一保镖和辽北地区著名狠人。他的名号常常比实际本事大，但吹牛背后是一个普通人对体面与被尊重的渴望。' }],
    ['lore_realism_tone', 'identity', { role: 'campaign_lore', description: '本世界遵循东北小人物现实喜剧基调：没有魔法、超能力或玄幻设定。人物不应被写成单纯好人或恶人，冲突来自贫穷、面子、误会、家庭责任和城市生活压力；叙事可以幽默，但不能嘲弄弱者。' }],
    ['quest_main', 'quest', { status: 'active', title: '马大帅进城', description: '在城里找到小翠，尊重她对婚姻与生活的选择，靠打工处理三万元礼钱，并帮助家人朋友在城乡变化中找到出路。', objectives: [{ text: '从客运站找到进城落脚的办法', status: 'active' }, { text: '找到范德彪并打听小翠下落', status: 'pending' }, { text: '与小翠谈清逃婚和婚约', status: 'pending' }, { text: '靠打工逐步偿还三万元礼钱', status: 'pending' }, { text: '照应玉芬和进城乡亲', status: 'pending' }, { text: '决定留城、回乡或把打工子弟学校办下去', status: 'locked' }], currentGuidance: '先和客运站外的玉芬说话，再根据撕破的地址条前往维多利亚寻找范德彪。' }],
    ['quest_find_debiao', 'quest', { status: 'active', phaseStatus: 'available', title: '找到范德彪', description: '马大帅的钱包和地址都被偷了。向玉芬、路人或饭店打听维多利亚，找到在那儿当保镖的范德彪。', nextSceneId: 'scene_victoria' }],
    ['quest_find_xiaocui', 'quest', { status: 'inactive', phaseStatus: 'hidden', title: '找到马小翠', description: '通过范德彪和维多利亚的关系找到小翠。见面后首先听她说明为什么逃婚，不要强迫她回村。', nextSceneId: 'scene_victoria' }],
    ['quest_repay_bridal_money', 'quest', { status: 'inactive', phaseStatus: 'locked', title: '挣回三万元礼钱', description: '在饭店、工地、浴池等地找正经活，记清每一笔收入，处理与余家的礼钱和婚约。', nextSceneId: 'scene_construction_site' }],
    ['quest_help_yufen', 'quest', { status: 'active', phaseStatus: 'available', title: '照应玉芬和乡亲', description: '玉芬和进城乡亲也有各自的难处。帮忙不只是给钱，还包括找活、讨薪、看病和在关键时候替人说句公道话。', nextSceneId: 'scene_yufen_home' }],
    ['quest_future_choice', 'quest', { status: 'inactive', phaseStatus: 'locked', title: '决定一家人的去处', description: '当婚约、礼钱和城里生活逐渐有了交代，决定回马家堡子、继续留城谋生，还是与大家一起把打工子弟学校办下去。', nextSceneId: 'scene_migrant_school' }],
  ];
  for (const [entityId, type, data] of components) upsertComponent(entityId, type, data);

  const relationships = [
    ['player', 'scene_bus_station', 'located_in', null, '马大帅刚在城市客运站下车。'],
    ['character_yufen', 'scene_bus_station', 'located_in', null, '玉芬在客运站外找到了马大帅，是开场引导者。'],
    ['character_fan_debiao', 'scene_victoria', 'located_in', null, '范德彪在维多利亚当保镖。'],
    ['character_ma_xiaocui', 'scene_victoria', 'located_in', null, '小翠暂时在维多利亚附近落脚。'],
    ['character_guiying', 'scene_guiying_restaurant', 'located_in', null, '桂英在自己的饭店忙活。'],
    ['character_wu', 'scene_victoria', 'located_in', null, '吴总在维多利亚处理生意。'],
    ['character_awei', 'scene_victoria', 'located_in', null, '阿薇在维多利亚工作。'],
    ['character_yu_fugui', 'scene_majia_village', 'located_in', null, '余富贵在马家堡子等马大帅给出交代。'],
    ['character_gangzi', 'scene_city_street', 'located_in', null, '钢子在城里街面处理自己的麻烦。'],
    ['player', 'item_erhu', 'ownership', null, '马大帅随身带着一把旧二胡。'],
    ['player', 'item_wooden_pole', 'ownership', null, '马大帅用一根木棍挑着行李进城。'],
    ['player', 'item_honghua_oil', 'ownership', null, '马大帅带着两份干活受伤时用的红花油。', { quantity: 2 }],
    ['scene_bus_station', 'item_torn_address', 'mentions', null, '客运站长椅下压着撕破的范德彪地址条。'],
    ['scene_victoria', 'item_debiao_business_card', 'mentions', null, '范德彪的名片印着维多利亚地址和夸张头衔。'],
    ['scene_victoria', 'item_victoria_badge', 'mentions', null, '吴总可以给临时帮工一张维多利亚工作牌。'],
    ['scene_majia_village', 'item_bridal_money_receipt', 'mentions', null, '三万元礼钱收据留在余富贵手里。'],
    ['scene_construction_site', 'item_wage_envelope', 'mentions', null, '工地结清工资后可以获得工资袋。'],
    ['scene_victoria', 'item_xiaocui_note', 'mentions', null, '小翠随身留着逃婚前写下的纸条。'],
    ['scene_migrant_school', 'item_school_ledger', 'mentions', null, '学校里有一本记录所有开支的账本。'],
    ['scene_majia_village', 'item_train_ticket', 'mentions', null, '回乡车票象征最终是否离开城市。'],
    ['scene_bus_station', 'scene_city_street', 'exit_to', null, '从客运站出口进入城里街面。'],
    ['scene_city_street', 'scene_bus_station', 'exit_to', null, '沿街向西可以回到客运站。'],
    ['scene_city_street', 'scene_victoria', 'exit_to', null, '顺着霓虹招牌可以找到维多利亚。'],
    ['scene_victoria', 'scene_city_street', 'exit_to', null, '维多利亚正门通向城里街面。'],
    ['scene_city_street', 'scene_guiying_restaurant', 'exit_to', null, '街角就是桂英饭店。'],
    ['scene_guiying_restaurant', 'scene_city_street', 'exit_to', null, '饭店前门回到街面。'],
    ['scene_victoria', 'scene_guiying_restaurant', 'exit_to', null, '维多利亚后街通往桂英饭店。'],
    ['scene_guiying_restaurant', 'scene_victoria', 'exit_to', null, '穿过后街可以到维多利亚。'],
    ['scene_city_street', 'scene_construction_site', 'exit_to', null, '招工车每天从街口去建筑工地。'],
    ['scene_construction_site', 'scene_city_street', 'exit_to', null, '工地下班后可返回城里街面。'],
    ['scene_city_street', 'scene_bathhouse', 'exit_to', null, '沿街向东是大众浴池。'],
    ['scene_bathhouse', 'scene_city_street', 'exit_to', null, '浴池门口回到城里街面。'],
    ['scene_city_street', 'scene_yufen_home', 'exit_to', null, '穿过居民巷可以到玉芬出租屋。'],
    ['scene_yufen_home', 'scene_city_street', 'exit_to', null, '出租屋外的小巷通向街面。'],
    ['scene_guiying_restaurant', 'scene_yufen_home', 'exit_to', null, '饭店后巷离玉芬出租屋不远。'],
    ['scene_yufen_home', 'scene_guiying_restaurant', 'exit_to', null, '从出租屋步行可以到桂英饭店。'],
    ['scene_construction_site', 'scene_majia_village', 'exit_to', null, '工地附近的长途车可以回马家堡子。'],
    ['scene_majia_village', 'scene_construction_site', 'exit_to', null, '村口班车通往城里的工地。'],
    ['scene_majia_village', 'scene_migrant_school', 'exit_to', null, '当大家决定办学后，可从城乡线路前往学校。'],
    ['scene_migrant_school', 'scene_majia_village', 'exit_to', null, '学校的班车线路通向马家堡子。'],
    ['character_yufen', 'player', 'trust', 55, '玉芬了解马大帅的实在，也担心他为了面子逞强。'],
    ['character_ma_xiaocui', 'player', 'trust', 25, '小翠爱父亲，但不再愿意让父亲替自己决定婚姻。'],
    ['character_fan_debiao', 'player', 'trust', 35, '范德彪嘴上埋怨姐夫，遇到真事还是愿意帮忙。'],
    ['character_yu_fugui', 'player', 'hostility', 20, '余富贵因为逃婚和礼钱对马大帅不满。'],
    ['character_yufen', 'player', 'affinity', 35, '玉芬与马大帅在互相照应中产生感情。'],
    ['character_guiying', 'character_fan_debiao', 'affinity', 30, '桂英对范德彪有好感，也看得穿他的吹牛。'],
    ['character_fan_debiao', 'character_awei', 'affinity', 25, '范德彪对阿薇一厢情愿。'],
    ['character_ma_xiaocui', 'character_gangzi', 'affinity', 40, '小翠愿意相信钢子，但也不希望被他的麻烦拖累。'],
    ['character_yufen', 'faction_ma_family', 'belongs_to', null, '玉芬是马家亲友的重要支柱。'],
    ['character_fan_debiao', 'faction_ma_family', 'belongs_to', null, '范德彪是小翠的舅舅。'],
    ['character_ma_xiaocui', 'faction_ma_family', 'belongs_to', null, '小翠是马大帅的女儿。'],
    ['character_fan_debiao', 'faction_victoria', 'belongs_to', null, '范德彪在维多利亚当保镖。'],
    ['character_wu', 'faction_victoria', 'belongs_to', null, '吴总是维多利亚老板。'],
    ['character_awei', 'faction_victoria', 'belongs_to', null, '阿薇在维多利亚工作。'],
    ['character_yu_fugui', 'faction_villagers', 'belongs_to', null, '余富贵代表马家堡子的乡情和压力。'],
    ['quest_main', 'quest_find_debiao', 'requires', null, '主线首先需要找到范德彪。'],
    ['quest_main', 'quest_find_xiaocui', 'requires', null, '主线需要找到小翠并谈清逃婚。'],
    ['quest_main', 'quest_repay_bridal_money', 'requires', null, '马大帅必须为三万元礼钱承担责任。'],
    ['quest_main', 'quest_help_yufen', 'requires', null, '城里生活不只围绕马大帅一个人。'],
    ['quest_future_choice', 'scene_migrant_school', 'requires', null, '最终的人生选择可在打工子弟学校展开。'],
    ['scene_bus_station', 'lore_city_migrant_life', 'mentions', null, '客运站展现进城务工者的第一道难关。'],
    ['scene_victoria', 'lore_debiao_reputation', 'mentions', null, '维多利亚最能体现范德彪对体面的追求。'],
    ['scene_majia_village', 'lore_runaway_wedding', 'mentions', null, '马家堡子保留着逃婚事件的全部后果。'],
    ['scene_majia_village', 'lore_bridal_money', 'mentions', null, '三万元礼钱是马家和余家之间的现实债务。'],
    ['character_yufen', 'lore_city_migrant_life', 'knows', null, '玉芬能提醒马大帅城里生活的现实规矩。'],
    ['character_fan_debiao', 'lore_debiao_reputation', 'knows', null, '范德彪本人最愿意讲述彪哥的各种名号。'],
    ['character_ma_xiaocui', 'lore_runaway_wedding', 'knows', null, '小翠最清楚自己为什么逃婚。'],
    ['character_yu_fugui', 'lore_bridal_money', 'knows', null, '余富贵掌握礼钱和婚约的具体情况。'],
  ];

  for (const [sourceId, targetId, type, value, summary, data = {}] of relationships) {
    upsertRelationship(sourceId, targetId, type, value, { source: 'seed', summary, ...data });
  }

  setMeta('playerId', 'player');
  setMeta('currentSceneId', 'scene_bus_station');
  setMeta('campaignId', MA_DASHUAI_CAMPAIGN_ID);
  setMeta('campaignTitle', '马大帅：进城以后');
  setMeta('campaignDay', '1');
  setMeta('inventory.items.v1', 'ready');
  addEvent('world.seeded', null, null, { summary: '初始化《马大帅：进城以后》默认游戏世界。' });
}

export function ensureMaDashuaiPlayableState(api) {
  const {
    getEntity,
    upsertEntity,
    setAliases,
    mergeComponentDefaults,
    applyStatsProfile,
    mergeInventoryDefaults,
    listRelationships,
    upsertRelationship,
    getMeta,
    setMeta,
  } = api;

  if (getMeta('campaignId', '') !== MA_DASHUAI_CAMPAIGN_ID) return;

  if (getEntity('player')) {
    upsertEntity('item_wooden_pole', 'item', '行李木棍');
    upsertEntity('item_erhu', 'item', '旧二胡');
    upsertEntity('item_honghua_oil', 'item', '红花油');
    setAliases('player', ['玩家', '老马', '大帅', '马叔', '马校长']);
    setAliases('item_wooden_pole', ['木棍', '挑行李的木棍', '棍子']);
    setAliases('item_honghua_oil', ['药油', '红花油', '跌打药']);
    mergeComponentDefaults('player', 'identity', {
      role: '进城寻找女儿的农民',
      description: '玩家扮演马大帅。小翠逃婚进城后，他来城里找女儿，却在长途车上丢了钱包和地址。',
      class: 'civilian',
      level: 1,
    });
    applyStatsProfile('player', getMaDashuaiPlayerStats(), MA_DASHUAI_PLAYER_PROFILE_ID, ['maxHitPoints', 'currentHitPoints']);
    mergeComponentDefaults('player', 'status', {
      state: 'healthy',
      label: '刚刚进城',
      description: '马大帅刚下长途车，钱包和地址都丢了，只剩随身行李和一把旧二胡。',
      canAct: true,
    });
    mergeInventoryDefaults('player', {
      items: ['item_erhu', 'item_wooden_pole'],
    });
    mergeComponentDefaults('item_wooden_pole', 'identity', {
      role: 'weapon',
      description: '原本用来挑行李的结实木棍，必要时也能当作临时武器。',
      weaponCategory: 'improvised melee weapon',
      damageDice: '1d4',
      versatileDamageDice: '1d6',
      damageType: 'bludgeoning',
      attackAbility: 'strength',
      proficient: true,
    });
    mergeComponentDefaults('item_erhu', 'identity', {
      role: 'tool',
      description: '马大帅随身带来的旧二胡，没钱时可以在街边拉琴换些饭钱。',
      effect: { type: 'narrative', targetQuestId: 'quest_main' },
    });
    mergeComponentDefaults('item_erhu', 'item', {
      category: 'tool',
      stackable: false,
      droppable: false,
      use: { type: 'narrative', target: 'optional_character', label: '拉一段二胡' },
    });
    mergeComponentDefaults('item_wooden_pole', 'item', {
      category: 'weapon',
      stackable: false,
      droppable: true,
    });
    mergeComponentDefaults('item_honghua_oil', 'identity', {
      role: 'consumable',
      description: '一小瓶红花油，干重活或挨碰以后能暂时缓和疼痛。',
    });
    mergeComponentDefaults('item_honghua_oil', 'item', {
      category: 'consumable',
      stackable: true,
      droppable: true,
      use: { type: 'restore_hit_points', target: 'self_or_character', amount: 4, consumeQuantity: 1 },
    });
    upsertRelationship('player', 'item_erhu', 'ownership', null, { source: 'baseline', summary: '马大帅随身带着一把旧二胡。' });
    const poleHasOwner = listRelationships({ entityId: 'item_wooden_pole', direction: 'in', type: 'ownership' }).length > 0;
    const poleHasLocation = listRelationships({ entityId: 'item_wooden_pole', direction: 'out', type: 'located_in' }).length > 0;
    if (!poleHasOwner && !poleHasLocation) {
      upsertRelationship('player', 'item_wooden_pole', 'ownership', null, { source: 'baseline', summary: '马大帅用一根木棍挑着行李进城。' });
    }
    if (getMeta('inventory.items.v1', '') !== 'ready') {
      upsertRelationship('player', 'item_honghua_oil', 'ownership', null, { source: 'baseline', summary: '马大帅带着两份干活受伤时用的红花油。', quantity: 2 });
      setMeta('inventory.items.v1', 'ready');
    }
  }

  if (getEntity('character_yufen')) {
    applyStatsProfile('character_yufen', getMaDashuaiYufenStats(), MA_DASHUAI_YUFEN_PROFILE_ID, ['maxHitPoints', 'currentHitPoints']);
  }

  if (getEntity('character_gangzi')) {
    applyStatsProfile('character_gangzi', getMaDashuaiGangziStats(), MA_DASHUAI_GANGZI_PROFILE_ID, ['maxHitPoints', 'currentHitPoints']);
  }
}
