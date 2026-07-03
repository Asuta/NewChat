export const MA_DASHUAI_PLAYER_PROFILE_ID = 'ma-dashuai-player-v1';
export const MA_DASHUAI_FAN_DEBIAO_PROFILE_ID = 'ma-dashuai-fan-debiao-v1';
export const MA_DASHUAI_NIU_ER_PROFILE_ID = 'ma-dashuai-niu-er-v1';

export function getMaDashuaiPlayerStats() {
  return {
    level: 1,
    stamina: 12,
    maxStamina: 12,
    money: 18,
    face: 45,
    kindness: 70,
    stubbornness: 68,
    streetSmarts: 20,
    eloquence: 42,
    laborSkill: 55,
    familyResponsibility: 85,
    reputationInVillage: 55,
    reputationInCity: 10,
  };
}

export function getMaDashuaiFanDebiaoStats() {
  return {
    level: 2,
    stamina: 10,
    maxStamina: 10,
    face: 82,
    kindness: 48,
    vanity: 90,
    bluffing: 76,
    loyalty: 45,
    streetSmarts: 38,
    troubleIndex: 75,
  };
}

export function getMaDashuaiNiuErStats() {
  return {
    level: 2,
    stamina: 11,
    maxStamina: 11,
    aggression: 78,
    intimidation: 70,
    patience: 15,
    reputationInCity: 25,
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
    ['scene_majia_baozi', 'scene', '马家堡子'],
    ['scene_bus_station', 'scene', '长途客运站'],
    ['scene_city_street', 'scene', '城市街头'],
    ['scene_victoria_plaza', 'scene', '维多利亚娱乐广场'],
    ['scene_security_room', 'scene', '范德彪保安室'],
    ['scene_dance_backstage', 'scene', '歌舞厅后台'],
    ['scene_yufen_room', 'scene', '玉芬住处'],
    ['scene_hospital', 'scene', '市医院'],
    ['scene_guiying_diner', 'scene', '桂英小饭馆'],
    ['scene_labor_market', 'scene', '零工市场'],
    ['scene_su_grandma_home', 'scene', '苏老太家'],
    ['scene_fishing_park', 'scene', '垂钓园工地'],
    ['scene_dream_clinic', 'scene', '范德彪解梦馆'],
    ['scene_wedding_hall', 'scene', '婚礼宴会厅'],
    ['character_xiaocui', 'character', '马小翠'],
    ['character_fan_debiao', 'character', '范德彪'],
    ['character_wang_yufen', 'character', '王玉芬'],
    ['character_gangzi', 'character', '钢子'],
    ['character_guiying', 'character', '桂英'],
    ['character_wu_boss', 'character', '吴总'],
    ['character_awei', 'character', '阿薇'],
    ['character_niu_er', 'character', '牛二'],
    ['character_su_grandma', 'character', '苏老太'],
    ['character_village_chief', 'character', '村长'],
    ['character_chief_son', 'character', '村长儿子'],
    ['character_li_ping', 'character', '李萍'],
    ['character_hu_qinghai', 'character', '胡庆海'],
    ['character_wang_boss', 'character', '王老板'],
    ['item_rural_bag', 'item', '进城包袱'],
    ['item_fan_address', 'item', '范德彪地址纸条'],
    ['item_bride_price_debt', 'item', '彩礼债'],
    ['item_yufen_medical_bill', 'item', '玉芬医药费单'],
    ['item_labor_wagon', 'item', '倒骑驴送煤车'],
    ['item_su_will', 'item', '苏老太遗嘱线索'],
    ['item_investment_plan', 'item', '垂钓园投资计划'],
    ['faction_majia_villagers', 'faction', '马家堡子乡亲'],
    ['faction_victoria', 'faction', '维多利亚娱乐广场'],
    ['faction_city_laborers', 'faction', '城里零工圈'],
    ['faction_guiying_diner', 'faction', '桂英饭馆圈'],
    ['faction_boss_circle', 'faction', '城里老板圈'],
    ['lore_rural_to_city', 'lore', '农村人进城'],
    ['lore_face_debt', 'lore', '面子与人情债'],
    ['lore_city_rules', 'lore', '城里规矩'],
    ['lore_family_choice', 'lore', '小翠的选择'],
    ['lore_hometown_return', 'lore', '回乡重新开始'],
    ['quest_main', 'quest', '主线：进城找小翠'],
    ['quest_find_xiaocui', 'quest', '找到马小翠'],
    ['quest_earn_money', 'quest', '挣钱还债'],
    ['quest_yufen_safety', 'quest', '照顾玉芬'],
    ['quest_fan_debiao_face', 'quest', '戳破范德彪的面子梦'],
    ['quest_xiaocui_choice', 'quest', '尊重小翠的选择'],
    ['quest_return_home', 'quest', '回马家堡子重新开始'],
  ];

  for (const [id, kind, name] of entities) upsertEntity(id, kind, name);

  const aliases = {
    player: ['玩家', '大帅', '老马', '马大叔', '马家堡子马大帅'],
    character_xiaocui: ['小翠', '马小翠', '大帅闺女'],
    character_fan_debiao: ['德彪', '彪哥', '范经理', '老舅'],
    character_wang_yufen: ['玉芬', '王玉芬'],
    character_gangzi: ['钢子'],
    character_guiying: ['桂英', '桂英老板娘'],
    character_wu_boss: ['吴总', '吴老板'],
    character_awei: ['阿薇'],
    character_niu_er: ['牛二', '玉芬前夫'],
    character_su_grandma: ['苏老太', '苏大娘'],
    character_village_chief: ['村长'],
    character_chief_son: ['村长儿子'],
    item_rural_bag: ['包袱', '行李'],
    item_fan_address: ['地址', '纸条', '范德彪地址'],
    item_bride_price_debt: ['彩礼钱', '礼钱债'],
    item_labor_wagon: ['倒骑驴', '送煤车'],
  };
  for (const [entityId, names] of Object.entries(aliases)) setAliases(entityId, names);

  const components = [
    ['player', 'identity', {
      role: '进城找女儿的农村父亲',
      description: '马大帅是马家堡子的普通农民，因为自作主张给女儿小翠安排婚事，导致小翠逃婚进城。他背着乡亲的眼光和彩礼债来到城市，想把女儿找回来，却一步步卷进打工、欠债、感情和面子的麻烦里。',
      class: 'ordinary_person',
      campaignRole: 'protagonist',
      background: '他不懂城里的规矩，嘴笨、心软、爱面子，但真遇到事总愿意替别人扛。',
      personality: ['善良', '倔强', '爱面子', '护短', '能吃苦'],
    }],
    ['player', 'stats', getMaDashuaiPlayerStats()],
    ['player', 'status', {
      state: 'active',
      label: '刚进城',
      description: '马大帅刚从马家堡子进城，钱不多，地址还攥在手里，心里只想着先找到小翠。',
      canAct: true,
    }],
    ['player', 'inventory', { items: ['item_rural_bag', 'item_fan_address', 'item_bride_price_debt'], equippedWeaponId: '' }],
    ['scene_majia_baozi', 'scene', {
      description: '东北乡村马家堡子。乡亲们熟人熟脸，什么事都能传遍全村。小翠逃婚和彩礼债从这里开始，马大帅的面子也丢在这里。',
      exits: ['scene_bus_station'], tags: ['开场', '乡村', '面子', '亲情'], visibility: 'public',
    }],
    ['scene_bus_station', 'scene', {
      description: '嘈杂的长途客运站。马大帅第一次进城，钱包、地址、方向感都可能在这里出岔子。这里适合触发问路、被骗、找范德彪的初始事件。',
      exits: ['scene_majia_baozi', 'scene_city_street'], tags: ['进城', '交通', '新手'], visibility: 'public',
    }],
    ['scene_city_street', 'scene', {
      description: '陌生城市的街头，霓虹、摊贩、保安、巡逻和看热闹的人混在一起。马大帅在这里体会到城里不是靠熟人脸面就能走通的地方。',
      exits: ['scene_bus_station', 'scene_victoria_plaza', 'scene_labor_market', 'scene_yufen_room'], tags: ['城市', '流浪', '过渡'], visibility: 'public',
    }],
    ['scene_victoria_plaza', 'scene', {
      description: '维多利亚娱乐广场是城里光鲜和虚荣的中心。范德彪在这里当保镖，小翠也在这里打工。这里有吴总的规矩、阿薇的疏离和范德彪的面子幻觉。',
      exits: ['scene_city_street', 'scene_security_room', 'scene_dance_backstage'], tags: ['娱乐城', '城市诱惑', '主线'], visibility: 'public',
    }],
    ['scene_security_room', 'scene', {
      description: '范德彪的保安室。墙上贴着规章，桌上摆着茶杯和旧报纸。德彪常在这里吹自己认识多少大人物，也常在这里把简单事办复杂。',
      exits: ['scene_victoria_plaza'], tags: ['范德彪', '喜剧冲突', '线索'], visibility: 'public',
    }],
    ['scene_dance_backstage', 'scene', {
      description: '歌舞厅后台，灯光、化妆镜和杂乱衣架挤在一起。小翠不愿回村，她想靠自己的方式留在城里。马大帅必须在管教和理解之间做选择。',
      exits: ['scene_victoria_plaza'], tags: ['小翠', '亲情', '选择'], visibility: 'public',
    }],
    ['scene_yufen_room', 'scene', {
      description: '玉芬在城里的临时住处，地方不大，却比街头踏实。她躲着前夫牛二，也在这里看见马大帅笨拙但真诚的一面。',
      exits: ['scene_city_street', 'scene_hospital'], tags: ['玉芬', '感情线', '安全屋'], visibility: 'public',
    }],
    ['scene_hospital', 'scene', {
      description: '市医院的走廊总是人多、灯白、钱紧。玉芬受伤后，医药费成为马大帅必须立刻解决的现实压力。',
      exits: ['scene_yufen_room', 'scene_labor_market'], tags: ['医药费', '压力', '转折'], visibility: 'public',
    }],
    ['scene_guiying_diner', 'scene', {
      description: '桂英小饭馆热气腾腾，菜味和吵嘴声一起往外冒。这里是范德彪落魄时的落脚处，也是许多市井消息和人情债的交换地。',
      exits: ['scene_city_street', 'scene_labor_market', 'scene_dream_clinic'], tags: ['饭馆', '市井', '范德彪'], visibility: 'public',
    }],
    ['scene_labor_market', 'scene', {
      description: '零工市场每天都有人等活。搬砖、送煤、陪护、当拳击靶子，来钱都不容易。这里是马大帅在城里活下去的日常循环。',
      exits: ['scene_city_street', 'scene_hospital', 'scene_guiying_diner', 'scene_su_grandma_home'], tags: ['打工', '挣钱', '生存'], visibility: 'public',
    }],
    ['scene_su_grandma_home', 'scene', {
      description: '苏老太家安静、陈旧，需要有人照顾。马大帅在这里能靠真诚赢得信任，也可能第一次发现城里并非只有冷脸和欺骗。',
      exits: ['scene_labor_market'], tags: ['陪护', '善良', '支线'], visibility: 'public',
    }],
    ['scene_fishing_park', 'scene', {
      description: '郊外垂钓园工地，牌子挂得漂亮，账目却说不清楚。范德彪想带乡亲投资翻身，这里也可能成为一场骗局的现场。',
      exits: ['scene_city_street', 'scene_majia_baozi'], tags: ['投资', '骗局', '乡亲'], visibility: 'public',
    }],
    ['scene_dream_clinic', 'scene', {
      description: '范德彪后来折腾出的解梦馆，屋里摆着玄乎道具，外头却没几个真顾客。这里适合承载德彪城市梦破碎后的自我反省。',
      exits: ['scene_guiying_diner', 'scene_city_street'], tags: ['落魄', '反省', '后期'], visibility: 'restricted',
    }],
    ['scene_wedding_hall', 'scene', {
      description: '婚礼宴会厅灯火通明，热闹背后都是人情和脸面。结局阶段，城里老板、范德彪、马大帅和家人可以在这里重新碰面。',
      exits: ['scene_city_street', 'scene_majia_baozi'], tags: ['结局', '人情', '抉择'], visibility: 'locked',
    }],
    ['character_xiaocui', 'identity', { role: '马大帅的女儿', description: '小翠因为被父亲擅自安排婚事而逃进城里。她不是简单叛逆，而是在争取自己选择生活的权利。', personality: ['倔强', '要面子', '想独立', '怕被安排'] }],
    ['character_xiaocui', 'status', { state: 'active', label: '不愿回村', description: '小翠在歌舞厅后台打工，不想马上跟马大帅回马家堡子。', canAct: true }],
    ['character_fan_debiao', 'identity', { role: '前小舅子与麻烦帮手', description: '范德彪在维多利亚当保镖，爱吹牛，讲排场，好面子，总想装成城里能人。他常常帮倒忙，但心底并不坏。', personality: ['好面子', '爱吹牛', '讲究', '心软', '容易膨胀'] }],
    ['character_fan_debiao', 'status', { state: 'active', label: '正在摆谱', description: '范德彪在保安室里端着架子，等着别人叫他彪哥。', canAct: true }],
    ['character_fan_debiao', 'stats', getMaDashuaiFanDebiaoStats()],
    ['character_wang_yufen', 'identity', { role: '马大帅的情感牵挂', description: '玉芬从农村来到城里，躲避前夫牛二纠缠。她看重踏实日子，也能看见马大帅笨拙外表下的真心。', personality: ['善良', '隐忍', '务实', '敏感'] }],
    ['character_wang_yufen', 'status', { state: 'active', label: '暂住城里', description: '玉芬暂时住在城里，既担心牛二，也担心马大帅逞强。', canAct: true }],
    ['character_gangzi', 'identity', { role: '小翠感情线人物', description: '钢子与小翠关系紧密，代表小翠想自己选择未来的那条路。', personality: ['年轻', '冲动', '讲义气'] }],
    ['character_gangzi', 'status', { state: 'active', label: '等待机会', description: '钢子在城里寻找能稳定下来的机会。', canAct: true }],
    ['character_guiying', 'identity', { role: '饭馆老板娘', description: '桂英经营小饭馆，泼辣直爽，嘴硬心热。她能看穿范德彪的虚张声势，却也愿意在他落魄时拉一把。', personality: ['泼辣', '直爽', '嘴硬心软'] }],
    ['character_guiying', 'status', { state: 'active', label: '忙着看店', description: '桂英在饭馆里招呼客人，也顺手管管范德彪的烂摊子。', canAct: true }],
    ['character_wu_boss', 'identity', { role: '娱乐城老板', description: '吴总掌握维多利亚娱乐广场的规矩和资源。他不是单纯恶人，但他的一句话能决定许多人有没有饭碗。', personality: ['精明', '现实', '讲利益'] }],
    ['character_wu_boss', 'status', { state: 'active', label: '掌控场子', description: '吴总在维多利亚娱乐广场处理生意和人情。', canAct: true }],
    ['character_awei', 'identity', { role: '娱乐城工作人员', description: '阿薇见惯了场面，对范德彪的热情保持距离。她常让范德彪误会自己在城里还有体面机会。', personality: ['冷静', '疏离', '会看人'] }],
    ['character_awei', 'status', { state: 'active', label: '照常上班', description: '阿薇在维多利亚处理自己的工作，不太愿意卷入德彪的幻想。', canAct: true }],
    ['character_niu_er', 'identity', { role: '玉芬前夫与现实威胁', description: '牛二纠缠玉芬，脾气暴，做事不讲理。他给马大帅的城市生活带来直接危险。', personality: ['暴躁', '蛮横', '纠缠不休'] }],
    ['character_niu_er', 'status', { state: 'hostile', label: '四处找玉芬', description: '牛二正在打听玉芬的去向，随时可能闹事。', canAct: true }],
    ['character_niu_er', 'stats', getMaDashuaiNiuErStats()],
    ['character_su_grandma', 'identity', { role: '陪护支线老人', description: '苏老太年纪大了，需要照顾。她考验的不是聪明，而是一个人有没有耐心和真心。', personality: ['孤独', '谨慎', '重情义'] }],
    ['character_su_grandma', 'status', { state: 'active', label: '需要照顾', description: '苏老太在家中休养，正在观察马大帅是不是可靠。', canAct: true }],
    ['character_village_chief', 'identity', { role: '乡村秩序代表', description: '村长代表马家堡子的脸面、人情和旧规矩。小翠逃婚后，他既要说法，也要保全村里的面子。', personality: ['讲规矩', '爱面子', '会施压'] }],
    ['character_village_chief', 'status', { state: 'active', label: '等说法', description: '村长在马家堡子等马大帅把小翠和彩礼的事处理明白。', canAct: true }],
    ['character_chief_son', 'identity', { role: '被逃婚的对象', description: '村长儿子原本被安排和小翠成亲，逃婚让他在村里很没面子。', personality: ['尴尬', '委屈', '要面子'] }],
    ['character_chief_son', 'status', { state: 'active', label: '丢了面子', description: '村长儿子被小翠逃婚弄得下不来台。', canAct: true }],
    ['character_li_ping', 'identity', { role: '外来新观念人物', description: '李萍受过正规教育，带来和马家堡子、维多利亚都不同的生活观念。她适合作为中后期调和冲突的角色。', personality: ['理性', '独立', '讲道理'] }],
    ['character_li_ping', 'status', { state: 'active', label: '旁观局势', description: '李萍暂时在城里旁观马大帅一家和范德彪的麻烦。', canAct: true }],
    ['character_hu_qinghai', 'identity', { role: '投资机会人物', description: '胡庆海可能愿意到马家堡子投资，也可能让马大帅重新思考回乡发展的路。', personality: ['现实', '会算账', '看重机会'] }],
    ['character_hu_qinghai', 'status', { state: 'active', label: '考察投资', description: '胡庆海正在评估马家堡子是否值得投资。', canAct: true }],
    ['character_wang_boss', 'identity', { role: '城里人情关系', description: '王老板代表城里另一套人情网络。他能给马大帅提供机会，也会把马大帅拉进新的饭局和面子场。', personality: ['圆滑', '讲场面', '重人情'] }],
    ['character_wang_boss', 'status', { state: 'active', label: '张罗宴席', description: '王老板正在筹备婚礼宴席和人情往来。', canAct: true }],
    ['item_rural_bag', 'identity', { role: 'starting_item', description: '马大帅进城时背的旧包袱，里面装着干粮、换洗衣服和乡下人的踏实劲。' }],
    ['item_fan_address', 'identity', { role: 'clue', description: '写着范德彪地址的纸条。丢了它，马大帅就只能在城里到处问路。', effect: { type: 'quest_guidance', targetQuestId: 'quest_find_xiaocui' } }],
    ['item_bride_price_debt', 'identity', { role: 'debt', description: '小翠逃婚留下的彩礼债。它不只是钱，也是马大帅在马家堡子丢掉的面子。' }],
    ['item_yufen_medical_bill', 'identity', { role: 'pressure_item', description: '玉芬受伤后的医药费单。它会把马大帅推向更危险、更辛苦的零工。' }],
    ['item_labor_wagon', 'identity', { role: 'work_tool', description: '一辆用来送煤、拉货的倒骑驴。它象征马大帅在城里靠力气活下去。' }],
    ['item_su_will', 'identity', { role: 'branch_clue', description: '苏老太支线中的遗嘱线索。它考验马大帅面对意外好处时是否还能守住本分。' }],
    ['item_investment_plan', 'identity', { role: 'risk_item', description: '范德彪张罗的垂钓园投资计划，听起来热闹，里面却藏着账目和人心风险。' }],
    ['faction_majia_villagers', 'identity', { role: 'home_faction', description: '马家堡子乡亲熟人社会。这里重情义，也重闲话和脸面。', goal: '让小翠逃婚和彩礼债有个说法。' }],
    ['faction_victoria', 'identity', { role: 'city_workplace', description: '维多利亚娱乐广场代表城里的光鲜工作、等级规矩和虚荣诱惑。', goal: '维持场子秩序和老板利益。' }],
    ['faction_city_laborers', 'identity', { role: 'labor_network', description: '城里零工圈靠消息、力气和临时机会活着。', goal: '今天有活干，今晚有地方睡。' }],
    ['faction_guiying_diner', 'identity', { role: 'street_life', description: '桂英饭馆圈是市井消息、人情互助和吵吵闹闹的交汇处。', goal: '把日子过下去，也别让熟人太难看。' }],
    ['faction_boss_circle', 'identity', { role: 'boss_network', description: '城里老板圈讲利益、场面和资源交换。', goal: '把人情变成生意，把生意变成面子。' }],
    ['lore_rural_to_city', 'identity', { role: 'campaign_lore', description: '这个世界的核心不是奇幻冒险，而是农村人进城后面对陌生规则、工作压力和身份落差。' }],
    ['lore_face_debt', 'identity', { role: 'campaign_lore', description: '面子和人情债常常比钱更难还。小翠逃婚、彩礼债、范德彪吹牛都围绕这一点展开。' }],
    ['lore_city_rules', 'identity', { role: 'campaign_lore', description: '城里规矩看似讲合同和岗位，实际也讲关系、眼色和谁能承担后果。马大帅必须慢慢学会。' }],
    ['lore_family_choice', 'identity', { role: 'campaign_lore', description: '小翠不是任务物品，她有自己的选择。玩家作为父亲，需要从“带她回去”成长到“理解她想怎么活”。' }],
    ['lore_hometown_return', 'identity', { role: 'campaign_lore', description: '城市梦并不一定是胜利。看清自己适合什么生活，带着经验回乡重新开始，也可以是结局。' }],
    ['quest_main', 'quest', {
      status: 'active',
      title: '进城找小翠',
      description: '从马家堡子进城找到逃婚的小翠，在陌生城市里挣钱、还债、照顾玉芬，并决定这个家最后该往哪里走。',
      objectives: [
        { text: '带着范德彪地址进城', status: 'active' },
        { text: '找到维多利亚娱乐广场和小翠', status: 'pending' },
        { text: '挣到足够的钱处理彩礼债和医药费', status: 'pending' },
        { text: '处理玉芬、牛二和范德彪带来的麻烦', status: 'pending' },
        { text: '理解小翠真正想要的生活', status: 'hidden' },
        { text: '决定继续留城还是回马家堡子重新开始', status: 'locked' },
      ],
      currentGuidance: '先从马家堡子出发，到长途客运站进城，再想办法找到范德彪所在的维多利亚娱乐广场。',
      participants: ['player', 'character_xiaocui', 'character_fan_debiao', 'character_wang_yufen'],
    }],
    ['quest_find_xiaocui', 'quest', { status: 'active', title: '找到马小翠', description: '根据范德彪地址和城里线索，找到在维多利亚歌舞厅后台打工的小翠。', objectives: [{ text: '抵达长途客运站', status: 'active' }, { text: '找到维多利亚娱乐广场', status: 'pending' }, { text: '进入歌舞厅后台见到小翠', status: 'pending' }], participants: ['player', 'character_xiaocui', 'character_fan_debiao'] }],
    ['quest_earn_money', 'quest', { status: 'active', title: '挣钱还债', description: '通过零工市场接活，偿还彩礼债、医药费和临时欠下的人情。', objectives: [{ text: '去零工市场接第一份活', status: 'active' }, { text: '获得倒骑驴送煤车', status: 'pending' }, { text: '攒够一笔能解决燃眉之急的钱', status: 'pending' }], participants: ['player'] }],
    ['quest_yufen_safety', 'quest', { status: 'active', title: '照顾玉芬', description: '帮助玉芬躲开牛二纠缠，筹措医药费，并让她有一个安全落脚处。', objectives: [{ text: '确认玉芬住处是否安全', status: 'active' }, { text: '处理牛二闹事', status: 'pending' }, { text: '筹措医药费', status: 'pending' }], participants: ['player', 'character_wang_yufen', 'character_niu_er'] }],
    ['quest_fan_debiao_face', 'quest', { status: 'inactive', title: '戳破范德彪的面子梦', description: '范德彪总想证明自己是城里能人。玩家需要判断什么时候顺着他，什么时候必须点醒他。', objectives: [{ text: '听范德彪讲城里门路', status: 'pending' }, { text: '识别一次范德彪吹大的麻烦', status: 'pending' }, { text: '在不毁掉情分的前提下把事说透', status: 'pending' }], participants: ['player', 'character_fan_debiao', 'character_guiying'] }],
    ['quest_xiaocui_choice', 'quest', { status: 'inactive', title: '尊重小翠的选择', description: '小翠不愿意只是被带回村。玩家需要真正理解她留城、工作和感情选择背后的原因。', objectives: [{ text: '和小翠认真谈一次', status: 'pending' }, { text: '观察钢子和小翠的关系', status: 'pending' }, { text: '决定是强行带回还是支持她自己承担后果', status: 'pending' }], participants: ['player', 'character_xiaocui', 'character_gangzi'] }],
    ['quest_return_home', 'quest', { status: 'inactive', title: '回马家堡子重新开始', description: '经历城市里的热闹和苦头后，玩家可以选择带着经验、人情和新关系回到马家堡子，重新安排生活。', objectives: [{ text: '处理清楚城里的主要人情债', status: 'locked' }, { text: '和范德彪谈清城市梦', status: 'locked' }, { text: '回马家堡子面对乡亲', status: 'locked' }], participants: ['player', 'character_fan_debiao', 'character_wang_yufen', 'character_xiaocui'] }],
  ];
  for (const [entityId, type, data] of components) upsertComponent(entityId, type, data);

  const relationships = [
    ['player', 'scene_majia_baozi', 'located_in', null, '马大帅从马家堡子出发，准备进城找小翠。'],
    ['character_xiaocui', 'scene_dance_backstage', 'located_in', null, '小翠在歌舞厅后台打工，暂时不愿回村。'],
    ['character_fan_debiao', 'scene_security_room', 'located_in', null, '范德彪在维多利亚保安室摆谱。'],
    ['character_wang_yufen', 'scene_yufen_room', 'located_in', null, '玉芬暂住城里，躲避牛二纠缠。'],
    ['character_gangzi', 'scene_dance_backstage', 'located_in', null, '钢子常在歌舞厅后台附近等小翠。'],
    ['character_guiying', 'scene_guiying_diner', 'located_in', null, '桂英在小饭馆照看生意。'],
    ['character_wu_boss', 'scene_victoria_plaza', 'located_in', null, '吴总掌控维多利亚娱乐广场。'],
    ['character_awei', 'scene_victoria_plaza', 'located_in', null, '阿薇在维多利亚上班。'],
    ['character_niu_er', 'scene_city_street', 'located_in', null, '牛二在城里打听玉芬下落。'],
    ['character_su_grandma', 'scene_su_grandma_home', 'located_in', null, '苏老太在家中需要照顾。'],
    ['character_village_chief', 'scene_majia_baozi', 'located_in', null, '村长在马家堡子等马大帅给说法。'],
    ['character_chief_son', 'scene_majia_baozi', 'located_in', null, '村长儿子因为逃婚丢了面子。'],
    ['character_li_ping', 'scene_guiying_diner', 'located_in', null, '李萍暂时在饭馆附近观察这群人的关系。'],
    ['character_hu_qinghai', 'scene_fishing_park', 'located_in', null, '胡庆海在垂钓园工地附近考察投资。'],
    ['character_wang_boss', 'scene_wedding_hall', 'located_in', null, '王老板在婚礼宴会厅张罗人情场。'],
    ['player', 'item_rural_bag', 'ownership', null, '马大帅进城时背着旧包袱。'],
    ['player', 'item_fan_address', 'ownership', null, '马大帅带着范德彪地址纸条进城。'],
    ['player', 'item_bride_price_debt', 'ownership', null, '小翠逃婚留下的彩礼债压在马大帅身上。'],
    ['scene_hospital', 'item_yufen_medical_bill', 'mentions', null, '市医院会触发玉芬医药费压力。'],
    ['scene_labor_market', 'item_labor_wagon', 'mentions', null, '零工市场可以获得倒骑驴送煤车。'],
    ['scene_su_grandma_home', 'item_su_will', 'mentions', null, '苏老太家隐藏遗嘱线索。'],
    ['scene_fishing_park', 'item_investment_plan', 'mentions', null, '垂钓园工地围绕投资计划展开。'],
    ['scene_majia_baozi', 'scene_bus_station', 'exit_to', null, '从马家堡子坐长途车进城。'],
    ['scene_bus_station', 'scene_majia_baozi', 'exit_to', null, '从客运站可以坐车回马家堡子。'],
    ['scene_bus_station', 'scene_city_street', 'exit_to', null, '离开客运站进入陌生城市街头。'],
    ['scene_city_street', 'scene_bus_station', 'exit_to', null, '从城市街头返回客运站。'],
    ['scene_city_street', 'scene_victoria_plaza', 'exit_to', null, '顺着打听到的线索去维多利亚娱乐广场。'],
    ['scene_victoria_plaza', 'scene_city_street', 'exit_to', null, '离开维多利亚回到街头。'],
    ['scene_victoria_plaza', 'scene_security_room', 'exit_to', null, '从大厅拐进范德彪保安室。'],
    ['scene_security_room', 'scene_victoria_plaza', 'exit_to', null, '从保安室回到维多利亚大厅。'],
    ['scene_victoria_plaza', 'scene_dance_backstage', 'exit_to', null, '从维多利亚进入歌舞厅后台找小翠。'],
    ['scene_dance_backstage', 'scene_victoria_plaza', 'exit_to', null, '从后台返回维多利亚大厅。'],
    ['scene_city_street', 'scene_yufen_room', 'exit_to', null, '从街头去玉芬临时住处。'],
    ['scene_yufen_room', 'scene_city_street', 'exit_to', null, '从玉芬住处回到街头。'],
    ['scene_yufen_room', 'scene_hospital', 'exit_to', null, '玉芬受伤后前往市医院。'],
    ['scene_hospital', 'scene_yufen_room', 'exit_to', null, '从医院返回玉芬住处。'],
    ['scene_hospital', 'scene_labor_market', 'exit_to', null, '为了医药费去零工市场找活。'],
    ['scene_labor_market', 'scene_hospital', 'exit_to', null, '从零工市场返回医院交钱。'],
    ['scene_city_street', 'scene_labor_market', 'exit_to', null, '从街头去零工市场接活。'],
    ['scene_labor_market', 'scene_city_street', 'exit_to', null, '从零工市场回到街头。'],
    ['scene_labor_market', 'scene_guiying_diner', 'exit_to', null, '收工后去桂英小饭馆吃口热饭。'],
    ['scene_guiying_diner', 'scene_labor_market', 'exit_to', null, '从饭馆去零工市场。'],
    ['scene_city_street', 'scene_guiying_diner', 'exit_to', null, '从街头去桂英小饭馆。'],
    ['scene_guiying_diner', 'scene_city_street', 'exit_to', null, '从饭馆回到街头。'],
    ['scene_labor_market', 'scene_su_grandma_home', 'exit_to', null, '从零工市场接陪护活去苏老太家。'],
    ['scene_su_grandma_home', 'scene_labor_market', 'exit_to', null, '从苏老太家回到零工市场。'],
    ['scene_city_street', 'scene_fishing_park', 'exit_to', null, '听范德彪张罗，去垂钓园工地看看。'],
    ['scene_fishing_park', 'scene_city_street', 'exit_to', null, '从垂钓园工地回城。'],
    ['scene_fishing_park', 'scene_majia_baozi', 'exit_to', null, '垂钓园线索可以引回马家堡子乡亲。'],
    ['scene_majia_baozi', 'scene_fishing_park', 'exit_to', null, '乡亲被投资计划打动后可去垂钓园。'],
    ['scene_guiying_diner', 'scene_dream_clinic', 'exit_to', null, '范德彪落魄后从饭馆折腾到解梦馆。'],
    ['scene_dream_clinic', 'scene_guiying_diner', 'exit_to', null, '从解梦馆回桂英饭馆。'],
    ['scene_dream_clinic', 'scene_city_street', 'exit_to', null, '从解梦馆走回街头。'],
    ['scene_city_street', 'scene_wedding_hall', 'exit_to', null, '后期可以去婚礼宴会厅参加人情场。'],
    ['scene_wedding_hall', 'scene_city_street', 'exit_to', null, '从婚礼宴会厅回到城里街头。'],
    ['scene_wedding_hall', 'scene_majia_baozi', 'exit_to', null, '结局阶段可从婚礼宴会厅回马家堡子。'],
    ['character_fan_debiao', 'player', 'affinity', 35, '范德彪嘴上摆谱，实际和马大帅有剪不断的亲戚情分。'],
    ['player', 'character_xiaocui', 'trust', 45, '马大帅疼小翠，但还没真正理解她想自己做主。'],
    ['character_wang_yufen', 'player', 'trust', 50, '玉芬能看见马大帅的真心，但担心他太逞强。'],
    ['character_niu_er', 'character_wang_yufen', 'hostility', 75, '牛二纠缠玉芬，是玉芬线的主要威胁。'],
    ['character_guiying', 'character_fan_debiao', 'affinity', 55, '桂英对范德彪又气又放不下。'],
    ['character_wu_boss', 'faction_victoria', 'belongs_to', null, '吴总代表维多利亚娱乐广场的老板权力。'],
    ['character_fan_debiao', 'faction_victoria', 'belongs_to', null, '范德彪在维多利亚当保镖。'],
    ['character_guiying', 'faction_guiying_diner', 'belongs_to', null, '桂英是小饭馆圈子的核心。'],
    ['character_village_chief', 'faction_majia_villagers', 'belongs_to', null, '村长代表马家堡子乡亲的压力。'],
    ['quest_main', 'quest_find_xiaocui', 'requires', null, '主线首先需要找到小翠。'],
    ['quest_main', 'quest_earn_money', 'requires', null, '主线推进离不开挣钱还债。'],
    ['quest_main', 'quest_yufen_safety', 'requires', null, '玉芬线会制造现实压力和情感牵挂。'],
    ['quest_main', 'quest_xiaocui_choice', 'requires', null, '最终要处理小翠自己的选择。'],
    ['quest_return_home', 'lore_hometown_return', 'requires', null, '回乡结局需要看清城市梦。'],
    ['scene_bus_station', 'lore_rural_to_city', 'mentions', null, '客运站体现农村人进城的第一道门槛。'],
    ['scene_victoria_plaza', 'lore_city_rules', 'mentions', null, '维多利亚展示城里规矩和光鲜表面。'],
    ['scene_majia_baozi', 'lore_face_debt', 'mentions', null, '马家堡子承载面子和彩礼债压力。'],
    ['scene_dance_backstage', 'lore_family_choice', 'mentions', null, '歌舞厅后台是小翠选择线的核心。'],
    ['character_fan_debiao', 'lore_face_debt', 'knows', null, '范德彪最懂面子，也最容易被面子害。'],
    ['character_wang_yufen', 'lore_rural_to_city', 'knows', null, '玉芬同样经历从农村到城市的漂泊。'],
    ['character_su_grandma', 'lore_city_rules', 'knows', null, '苏老太支线让马大帅看到城里也有人情。'],
  ];

  for (const [sourceId, targetId, type, value, summary] of relationships) {
    upsertRelationship(sourceId, targetId, type, value, { source: 'seed', summary });
  }

  setMeta('playerId', 'player');
  setMeta('currentSceneId', 'scene_majia_baozi');
  setMeta('campaignId', 'ma-dashuai-city-life');
  setMeta('campaignTitle', '马大帅：进城找小翠');
  setMeta('campaignDay', '1');
  addEvent('world.seeded', null, null, { summary: '初始化马大帅预制世界：从马家堡子进城找小翠。' });
}

export function ensureMaDashuaiPlayableState(api) {
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
    upsertEntity('item_rural_bag', 'item', '进城包袱');
    upsertEntity('item_fan_address', 'item', '范德彪地址纸条');
    upsertEntity('item_bride_price_debt', 'item', '彩礼债');
    setAliases('player', ['玩家', '大帅', '老马', '马大叔', '马家堡子马大帅']);
    setAliases('item_fan_address', ['地址', '纸条', '范德彪地址']);
    mergeComponentDefaults('player', 'identity', {
      role: '进城找女儿的农村父亲',
      description: '马大帅从马家堡子进城寻找逃婚的女儿小翠。',
      class: 'ordinary_person',
      campaignRole: 'protagonist',
    });
    applyStatsProfile('player', getMaDashuaiPlayerStats(), MA_DASHUAI_PLAYER_PROFILE_ID, ['money', 'stamina']);
    mergeComponentDefaults('player', 'status', {
      state: 'active',
      label: '刚进城',
      description: '马大帅正在找小翠和范德彪。',
      canAct: true,
    });
    mergeInventoryDefaults('player', {
      items: ['item_rural_bag', 'item_fan_address', 'item_bride_price_debt'],
      equippedWeaponId: '',
    });
    mergeComponentDefaults('item_rural_bag', 'identity', {
      role: 'starting_item',
      description: '马大帅进城时背的旧包袱。',
    });
    mergeComponentDefaults('item_fan_address', 'identity', {
      role: 'clue',
      description: '写着范德彪地址的纸条，是找到小翠的重要线索。',
      effect: { type: 'quest_guidance', targetQuestId: 'quest_find_xiaocui' },
    });
    mergeComponentDefaults('item_bride_price_debt', 'identity', {
      role: 'debt',
      description: '小翠逃婚留下的彩礼债。',
    });
    upsertRelationship('player', 'item_rural_bag', 'ownership', null, { source: 'baseline', summary: '马大帅背着进城包袱。' });
    upsertRelationship('player', 'item_fan_address', 'ownership', null, { source: 'baseline', summary: '马大帅带着范德彪地址纸条。' });
    upsertRelationship('player', 'item_bride_price_debt', 'ownership', null, { source: 'baseline', summary: '马大帅背着小翠逃婚留下的彩礼债。' });
  }

  if (getEntity('character_fan_debiao')) {
    applyStatsProfile('character_fan_debiao', getMaDashuaiFanDebiaoStats(), MA_DASHUAI_FAN_DEBIAO_PROFILE_ID, ['stamina']);
  }

  if (getEntity('character_niu_er')) {
    applyStatsProfile('character_niu_er', getMaDashuaiNiuErStats(), MA_DASHUAI_NIU_ER_PROFILE_ID, ['stamina']);
  }
}
