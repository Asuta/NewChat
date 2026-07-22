export const MA_DASHUAI_PLAYER_PROFILE_ID = 'ma-dashuai-player-v1';
export const MA_DASHUAI_CAMPAIGN_ID = 'ma-dashuai-city-life';
export const MA_DASHUAI_YUFEN_PROFILE_ID = 'ma-dashuai-yufen-v1';
export const MA_DASHUAI_GANGZI_PROFILE_ID = 'ma-dashuai-gangzi-v1';
export const MA_DASHUAI_PRESET_REVISION = 'ma-dashuai-episode-guide-v3';

export const MA_DASHUAI_VICTORIA_SCENE_ENTITIES = Object.freeze([
  ['scene_victoria', 'scene', '维多利亚娱乐广场'],
  ['scene_victoria_dance_hall', 'scene', '维多利亚歌舞厅'],
  ['scene_victoria_office', 'scene', '吴总办公室'],
  ['scene_victoria_backstage', 'scene', '维多利亚后台'],
]);

export const MA_DASHUAI_VICTORIA_SCENE_COMPONENTS = Object.freeze([
  ['scene_victoria', 'scene', {
    description: '维多利亚娱乐广场的正门、迎宾前厅和内部中央走廊。范德彪在正门维持秩序；歌舞厅、吴总办公室、后台、餐厅和桑拿都是从这里进入的独立区域，不再与前厅混作一个场景。',
    exits: ['scene_city_street', 'scene_debiao_home', 'scene_victoria_dance_hall', 'scene_victoria_office', 'scene_victoria_restaurant', 'scene_bathhouse', 'scene_bar'], tags: ['第1—16集', '维多利亚', '正门', '前厅', '范德彪'], visibility: 'restricted',
  }],
  ['scene_victoria_dance_hall', 'scene', {
    description: '维多利亚的歌舞厅营业区，舞台、散台和服务通道彼此相连。开场时小翠刚被范德彪领进来暂候安排，还没有换上制服，也没有正式成为服务员。',
    exits: ['scene_victoria', 'scene_victoria_office', 'scene_victoria_backstage'], tags: ['第1—16集', '维多利亚', '歌舞厅', '小翠'], visibility: 'restricted',
  }],
  ['scene_victoria_office', 'scene', {
    description: '吴总处理维多利亚账目、生意和私人谈话的办公室，与前厅和歌舞厅相通。没有得到吴总、范德彪或工作人员允许时，不适合随便闯入。',
    exits: ['scene_victoria', 'scene_victoria_dance_hall'], tags: ['第1—16集', '维多利亚', '吴总', '办公室'], visibility: 'restricted',
  }],
  ['scene_victoria_backstage', 'scene', {
    description: '歌舞厅后的更衣、候场和员工准备区域。阿薇正在这里准备上班，工作人员可以从后台直接进入歌舞厅。',
    exits: ['scene_victoria_dance_hall'], tags: ['第1—16集', '维多利亚', '后台', '阿薇'], visibility: 'restricted',
  }],
]);

export const MA_DASHUAI_VICTORIA_CHARACTER_LOCATIONS = Object.freeze([
  ['character_fan_debiao', 'scene_victoria', 'located_in', null, '范德彪在维多利亚正门和前厅维持秩序。'],
  ['character_ma_xiaocui', 'scene_victoria_dance_hall', 'located_in', null, '小翠刚逃婚进城投奔范德彪，正在尚未营业的歌舞厅等候工作安排。'],
  ['character_wu', 'scene_victoria_office', 'located_in', null, '吴总在自己的办公室处理维多利亚的生意。'],
  ['character_awei', 'scene_victoria_backstage', 'located_in', null, '阿薇在歌舞厅后台准备上班。'],
]);

export const MA_DASHUAI_VICTORIA_INTERNAL_EXITS = Object.freeze([
  ['scene_victoria', 'scene_victoria_dance_hall', 'exit_to', null, '从维多利亚前厅进入歌舞厅营业区。'],
  ['scene_victoria_dance_hall', 'scene_victoria', 'exit_to', null, '歌舞厅出口回到维多利亚前厅。'],
  ['scene_victoria', 'scene_victoria_office', 'exit_to', null, '从维多利亚前厅沿内部走廊前往吴总办公室。'],
  ['scene_victoria_office', 'scene_victoria', 'exit_to', null, '吴总办公室外的走廊回到维多利亚前厅。'],
  ['scene_victoria_dance_hall', 'scene_victoria_office', 'exit_to', null, '歌舞厅内侧通道通往吴总办公室。'],
  ['scene_victoria_office', 'scene_victoria_dance_hall', 'exit_to', null, '吴总可以从办公室直接进入歌舞厅。'],
  ['scene_victoria_dance_hall', 'scene_victoria_backstage', 'exit_to', null, '歌舞厅的员工通道通往后台。'],
  ['scene_victoria_backstage', 'scene_victoria_dance_hall', 'exit_to', null, '后台出口回到歌舞厅。'],
]);

export const MA_DASHUAI_CHARACTER_HIT_POINTS = Object.freeze({
  character_yufen: 14,
  character_fan_debiao: 18,
  character_ma_xiaocui: 12,
  character_guiying: 14,
  character_wu: 16,
  character_awei: 12,
  character_yu_fugui: 16,
  character_gangzi: 20,
  character_yu_decai: 14,
  character_niu_er: 18,
  character_xiaoyun: 12,
  character_erhu_busker: 12,
  character_wandering_child: 10,
  character_gangzi_brother: 12,
  character_lao_ba: 22,
  character_lao_qian: 14,
  character_gao_juzhang: 12,
  character_wang_boss: 16,
  character_boxer_son: 22,
  character_su_old_lady: 8,
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
    ...MA_DASHUAI_VICTORIA_SCENE_ENTITIES,
    ['scene_debiao_home', 'scene', '范德彪住处'],
    ['scene_xiaoyun_home', 'scene', '小芸住处'],
    ['scene_detention_center', 'scene', '看守所'],
    ['scene_victoria_restaurant', 'scene', '维多利亚餐厅'],
    ['scene_guiying_restaurant', 'scene', '桂英饭店'],
    ['scene_bathhouse', 'scene', '维多利亚桑拿浴室'],
    ['scene_bar', 'scene', '城里酒吧'],
    ['scene_hospital', 'scene', '市医院'],
    ['scene_gao_home', 'scene', '高局长家'],
    ['scene_wang_boxing_room', 'scene', '王老板拳击训练室'],
    ['scene_fishing_park', 'scene', '垂钓园荒坑'],
    ['scene_su_home', 'scene', '苏老太太家'],
    ['scene_oldscar_hideout', 'scene', '老疤郊外藏身处'],
    ['scene_jail_visiting_room', 'scene', '监所会见室'],
    ['scene_majia_village', 'scene', '马家堡子'],
    ['scene_migrant_school', 'scene', '大帅打工子弟小学'],
    ['character_yufen', 'character', '王玉芬'],
    ['character_fan_debiao', 'character', '范德彪'],
    ['character_ma_xiaocui', 'character', '马小翠'],
    ['character_guiying', 'character', '桂英'],
    ['character_wu', 'character', '吴总'],
    ['character_awei', 'character', '阿薇'],
    ['character_yu_fugui', 'character', '余富贵'],
    ['character_gangzi', 'character', '钢子'],
    ['character_yu_decai', 'character', '余德财'],
    ['character_niu_er', 'character', '牛二'],
    ['character_xiaoyun', 'character', '小芸'],
    ['character_erhu_busker', 'character', '装瞎卖艺人'],
    ['character_wandering_child', 'character', '流浪孩子小头领'],
    ['character_gangzi_brother', 'character', '钢子的弟弟'],
    ['character_lao_ba', 'character', '老疤'],
    ['character_lao_qian', 'character', '老钱'],
    ['character_gao_juzhang', 'character', '高局长'],
    ['character_wang_boss', 'character', '王老板'],
    ['character_boxer_son', 'character', '王老板的儿子'],
    ['character_su_old_lady', 'character', '苏老太太'],
    ['item_luggage_bundle', 'item', '随身行李'],
    ['item_erhu', 'item', '卖艺二胡'],
    ['item_wooden_pole', 'item', '行李木棍'],
    ['item_honghua_oil', 'item', '红花油'],
    ['item_lost_wallet', 'item', '被偷的钱包'],
    ['item_lost_address', 'item', '遗失的范德彪地址'],
    ['item_missing_person_notice', 'item', '报纸寻人启事'],
    ['item_counterfeit_note', 'item', '涉案假钞'],
    ['item_detention_release_form', 'item', '看守所释放手续'],
    ['item_victoria_uniform', 'item', '维多利亚服务员制服'],
    ['item_victoria_badge', 'item', '维多利亚工作牌'],
    ['item_bridal_money_receipt', 'item', '三万元彩礼收据'],
    ['item_bridal_money_iou', 'item', '三万元欠条'],
    ['item_wu_cash', 'item', '吴总提供的三万元'],
    ['item_restaurant_apron', 'item', '餐厅杂工围裙'],
    ['item_debt_ledger', 'item', '公司欠款账册'],
    ['item_hospital_bill', 'item', '玉芬医药费单据'],
    ['item_debiao_resignation', 'item', '范德彪辞职书'],
    ['item_fishing_contract', 'item', '垂钓园投资合同'],
    ['item_villager_fund_ledger', 'item', '乡亲八万元集资账'],
    ['item_boxing_gloves', 'item', '拳击陪练护具'],
    ['item_tricycle', 'item', '范德彪的载客三轮车'],
    ['item_gangzi_surrender_record', 'item', '钢子投案记录'],
    ['item_pregnancy_report', 'item', '小翠孕检报告'],
    ['item_su_will', 'item', '苏老太太遗嘱'],
    ['item_inheritance_certificate', 'item', '五十余万元遗产证明'],
    ['item_school_ledger', 'item', '学校收支账本'],
    ['item_debiao_business_card', 'item', '范德彪名片'],
    ['faction_ma_family', 'faction', '马家亲友'],
    ['faction_victoria', 'faction', '维多利亚关系网'],
    ['faction_villagers', 'faction', '马家堡子乡亲'],
    ['faction_wandering_children', 'faction', '流浪孩子们'],
    ['faction_police', 'faction', '城市公安'],
    ['faction_oldscar_group', 'faction', '老疤一伙'],
    ['lore_runaway_wedding', 'lore', '小翠逃婚'],
    ['lore_bridal_money', 'lore', '三万元彩礼'],
    ['lore_yufen_niu_er', 'lore', '玉芬与牛二的纠葛'],
    ['lore_wu_xiaocui', 'lore', '吴总对小翠的追求'],
    ['lore_gangzi_oldscar', 'lore', '钢子与老疤的旧怨'],
    ['lore_debiao_vanity', 'lore', '范德彪的体面与虚荣'],
    ['lore_fishing_scam', 'lore', '垂钓园集资骗局'],
    ['lore_wandering_children', 'lore', '流浪孩子与办学念头'],
    ['lore_su_inheritance', 'lore', '苏老太太的遗产'],
    ['lore_realism_tone', 'lore', '东北小人物现实喜剧'],
    ['quest_main', 'quest', '主线：马大帅进城寻女'],
    ['quest_survive_city', 'quest', '身无分文在城里活下来'],
    ['quest_find_debiao', 'quest', '寻找范德彪'],
    ['quest_find_xiaocui', 'quest', '父女见面'],
    ['quest_cancel_marriage', 'quest', '退婚与三万元彩礼'],
    ['quest_city_jobs', 'quest', '马大帅的谋生经历'],
    ['quest_yufen_niu_er', 'quest', '保护玉芬摆脱牛二'],
    ['quest_xiaocui_relationship', 'quest', '小翠的感情选择'],
    ['quest_debiao_business', 'quest', '范德彪的发财梦'],
    ['quest_gangzi_revenge', 'quest', '钢子与老疤'],
    ['quest_wandering_children', 'quest', '流浪孩子们'],
    ['quest_su_old_lady', 'quest', '照顾苏老太太'],
    ['quest_build_school', 'quest', '创办打工子弟小学'],
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
    character_yu_decai: ['余德财', '余富贵的儿子', '新郎'],
    character_niu_er: ['牛二', '玉芬前夫'],
    character_xiaoyun: ['小芸', '小翠朋友'],
    character_erhu_busker: ['装瞎拉二胡的人', '卖艺人', '假瞎子'],
    character_wandering_child: ['流浪孩子', '干儿子'],
    character_gangzi_brother: ['钢子弟弟'],
    character_lao_ba: ['老疤'],
    character_lao_qian: ['老钱', '垂钓园老板'],
    character_gao_juzhang: ['高局长', '退休高局长'],
    character_wang_boss: ['王老板'],
    character_boxer_son: ['拳击手', '王老板儿子'],
    character_su_old_lady: ['苏老太太', '干妈'],
    item_luggage_bundle: ['行李', '包袱', '随身行李'],
    item_wooden_pole: ['木棍', '挑行李的木棍', '棍子'],
    item_erhu: ['二胡', '卖艺人的二胡'],
    item_honghua_oil: ['药油', '红花油', '跌打药'],
    item_lost_wallet: ['钱包', '被偷的钱包'],
    item_lost_address: ['范德彪地址', '地址条'],
    item_bridal_money_iou: ['三万元欠条', '彩礼欠条'],
    item_fishing_contract: ['垂钓园合同', '投资合同'],
    item_villager_fund_ledger: ['八万元集资款', '集资账'],
    item_su_will: ['遗嘱', '苏老太太遗嘱'],
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
      label: '进城寻女，身无分文',
      description: '马大帅刚下长途车便发现钱包和范德彪的地址都被偷走，只剩随身行李。他还不知道小翠已经到了维多利亚，也不知道该往哪里找。',
      canAct: true,
    }],
    ['player', 'inventory', { items: ['item_luggage_bundle', 'item_wooden_pole', 'item_honghua_oil'] }],
    ['scene_bus_station', 'scene', {
      description: '世纪之交的东北小城客运站，人声嘈杂，售票窗口、候车长椅和站外广场挤满旅客。马大帅刚发现钱包与范德彪的地址都被扒手偷走，只能先在车站附近想办法活下来。',
      exits: ['scene_city_street'], tags: ['第1集', '开场', '客运站', '钱包被偷', '寻女'], visibility: 'public',
    }],
    ['scene_city_street', 'scene', {
      description: '客运站外的城里街面，商铺、公交站和小摊混在一起。马大帅会在这里遇到装瞎拉二胡的卖艺人，也会因为陌生城市的规矩和生计问题屡屡碰壁。',
      exits: ['scene_bus_station', 'scene_victoria', 'scene_debiao_home', 'scene_detention_center', 'scene_guiying_restaurant', 'scene_hospital', 'scene_gao_home', 'scene_wang_boxing_room', 'scene_fishing_park', 'scene_su_home', 'scene_oldscar_hideout', 'scene_jail_visiting_room', 'scene_majia_village', 'scene_migrant_school'], tags: ['第1—3集', '城市', '流浪', '卖艺', '找路'], visibility: 'public',
    }],
    ...MA_DASHUAI_VICTORIA_SCENE_COMPONENTS,
    ['scene_debiao_home', 'scene', {
      description: '范德彪在城里的住处，是马大帅、玉芬、小翠和范德彪处理家事与误会的主要落脚点。第4集以前马大帅还不知道这里。',
      exits: ['scene_city_street', 'scene_victoria', 'scene_xiaoyun_home'], tags: ['第4—18集', '住处', '家庭', '感情误会'], visibility: 'locked',
    }],
    ['scene_xiaoyun_home', 'scene', {
      description: '小芸在城里的住处。小翠得知父亲获释后会暂时躲在这里，直到马大帅跟踪范德彪找到她。',
      exits: ['scene_debiao_home', 'scene_city_street'], tags: ['第5集', '小芸', '小翠藏身'], visibility: 'locked',
    }],
    ['scene_detention_center', 'scene', {
      description: '城市看守所。马大帅会因车站假钞误会被关进来，后来由范德彪开吴总的车接走。这里也代表普通人在陌生城市里因误会付出的现实代价。',
      exits: ['scene_city_street'], tags: ['第3—4集', '假钞', '看守所'], visibility: 'locked',
    }],
    ['scene_victoria_restaurant', 'scene', {
      description: '维多利亚旗下餐厅。马大帅做不成搓澡工后会被调来当杂工、送盒饭，并因误认客人吸毒在第11集被开除。',
      exits: ['scene_victoria', 'scene_city_street'], tags: ['第8—11集', '餐厅', '杂工', '送盒饭'], visibility: 'locked',
    }],
    ['scene_guiying_restaurant', 'scene', {
      description: '桂英经营的小饭店。第10集范德彪会带桂英回家试探玉芬，第25集创业失败后也会回到这里当厨师、开始脚踏实地生活。',
      exits: ['scene_city_street', 'scene_debiao_home'], tags: ['第10集', '第25集', '桂英', '范德彪归宿'], visibility: 'locked',
    }],
    ['scene_bathhouse', 'scene', {
      description: '维多利亚桑拿浴室。范德彪会在第6集把马大帅安排到这里当搓澡工；马大帅不懂规矩、频频得罪客人，最终无法胜任。',
      exits: ['scene_victoria'], tags: ['第6—8集', '桑拿', '搓澡工', '谋生'], visibility: 'locked',
    }],
    ['scene_bar', 'scene', {
      description: '吴总约钢子谈判的酒吧。第14集他会提出用钱换钢子离开小翠，并被钢子当面拒绝。',
      exits: ['scene_victoria', 'scene_city_street'], tags: ['第14集', '吴总', '钢子', '谈判'], visibility: 'locked',
    }],
    ['scene_hospital', 'scene', {
      description: '玉芬被牛二打成重伤后住院的市医院。医药费压力促使马大帅接下陪聊和拳击陪练工作，他也会在这里认识王老板。',
      exits: ['scene_city_street', 'scene_debiao_home', 'scene_wang_boxing_room'], tags: ['第13—23集', '玉芬住院', '医药费'], visibility: 'locked',
    }],
    ['scene_gao_home', 'scene', {
      description: '退休高局长的家。马大帅从第16集起在这里陪高局长聊天，用朴实经历帮助他走出退休后的失落。',
      exits: ['scene_city_street'], tags: ['第16—21集', '高局长', '陪聊'], visibility: 'locked',
    }],
    ['scene_wang_boxing_room', 'scene', {
      description: '王老板为儿子准备的拳击训练室。马大帅为了玉芬的医药费做危险陪练，在这里被打得鼻青脸肿。',
      exits: ['scene_hospital', 'scene_city_street'], tags: ['第18—23集', '拳击陪练', '医药费'], visibility: 'locked',
    }],
    ['scene_fishing_park', 'scene', {
      description: '老钱吹嘘为稳赚项目的垂钓园现场，最初只是一个荒废大坑，骗走乡亲八万元后甚至被填平。',
      exits: ['scene_city_street', 'scene_majia_village'], tags: ['第17—22集', '垂钓园', '集资骗局'], visibility: 'hidden',
    }],
    ['scene_su_home', 'scene', {
      description: '孤独的苏老太太家。马大帅从第23集起照顾她，凭真诚让她重新感受到亲情，并在她去世后继承五十余万元。',
      exits: ['scene_city_street'], tags: ['第23—27集', '苏老太太', '遗产'], visibility: 'locked',
    }],
    ['scene_oldscar_hideout', 'scene', {
      description: '老疤在郊外藏匿的地方。第25集小翠被绑到这里，钢子与老疤恶斗，马大帅设法报警争取救援。',
      exits: ['scene_city_street'], tags: ['第25集', '绑架', '老疤', '营救'], visibility: 'hidden',
    }],
    ['scene_jail_visiting_room', 'scene', {
      description: '钢子投案后的监所会见室。小翠会在这里探望钢子，而钢子为了不拖累她选择拒绝见面。',
      exits: ['scene_city_street'], tags: ['第26集', '钢子', '探监'], visibility: 'locked',
    }],
    ['scene_majia_village', 'scene', {
      description: '马大帅、小翠、玉芬、余富贵和余德财生活的马家堡子。开场时玉芬仍在这里遭牛二纠缠，余家也正因婚礼当天逃婚向马大帅讨说法。',
      exits: ['scene_city_street', 'scene_fishing_park'], tags: ['第1集', '第7—8集', '村庄', '逃婚', '彩礼'], visibility: 'restricted',
    }],
    ['scene_migrant_school', 'scene', {
      description: '第27集马大帅用苏老太太留下的五十余万元创办的打工子弟小学，让流浪儿童和进城务工者的孩子有书可读。开场时学校尚不存在。',
      exits: ['scene_city_street'], tags: ['第27集', '未来', '学校', '流浪儿童'], visibility: 'hidden',
    }],
    ['character_yufen', 'identity', {
      role: '马大帅心仪的同村人',
      description: '王玉芬朴实能干，长期受到前夫牛二纠缠。开场时她仍在马家堡子，并不知道马大帅已在城里失去联系；第4集才会为躲避牛二并寻找马大帅独自进城。',
      personality: ['善良', '能干', '有主见', '重感情'],
      knowledgeBoundary: ['知道马大帅进城寻女', '不知道马大帅钱包被偷或被关进看守所', '进城前不知道小翠和范德彪的具体住处'],
    }],
    ['character_yufen', 'status', { state: 'healthy', label: '留在村里受牛二纠缠', description: '玉芬刚与马大帅告别，仍在马家堡子面对前夫牛二的威胁，尚未决定进城。', canAct: true }],
    ['character_yufen', 'stats', getMaDashuaiYufenStats()],
    ['character_fan_debiao', 'identity', {
      role: '小舅子与城市向导',
      description: '范德彪是小翠的舅舅，在维多利亚给吴总当保镖，表面上混得风光。他爱面子、爱吹牛，后来会因误判感情和轻信老钱的垂钓园项目付出沉重代价。',
      personality: ['爱面子', '能吹', '热心', '容易冲动'],
      knowledgeBoundary: ['知道小翠已投奔自己', '开场不知道马大帅已经进城', '尚不知道吴总会追求小翠'],
    }],
    ['character_fan_debiao', 'status', { state: 'active', label: '维持场面', description: '范德彪正在维多利亚门口维持秩序，努力让所有人都看见自己的派头。', canAct: true }],
    ['character_fan_debiao', 'stats', getMaDashuaiCharacterHitPointStats('character_fan_debiao')],
    ['character_ma_xiaocui', 'identity', {
      role: '马大帅的女儿',
      description: '马小翠不愿接受父亲安排给余德财的婚事，在婚礼当天逃进城投奔舅舅范德彪。开场时她刚到维多利亚，尚未认识小芸和钢子，也没有成为吴总的秘书。',
      personality: ['倔强', '独立', '心软', '敢闯'],
      knowledgeBoundary: ['知道逃婚会让父亲和余家难堪', '不知道父亲已丢失钱包和地址', '尚未认识钢子'],
    }],
    ['character_ma_xiaocui', 'status', { state: 'active', label: '刚投奔舅舅', description: '小翠刚来到维多利亚，范德彪答应替她找工作；她还不知道马大帅已进城寻她。', canAct: true }],
    ['character_ma_xiaocui', 'stats', getMaDashuaiCharacterHitPointStats('character_ma_xiaocui')],
    ['character_guiying', 'identity', {
      role: '饭店老板',
      description: '桂英经营自己的小饭店，性格爽快务实。她会在范德彪感情受挫和创业失败后逐渐走近他，但开场时两人的感情线尚未发生。',
      personality: ['爽快', '泼辣', '务实', '刀子嘴豆腐心'],
    }],
    ['character_guiying', 'status', { state: 'active', label: '经营自己的饭店', description: '桂英正忙着经营小饭店，尚未卷入马大帅一家和范德彪的感情误会。', canAct: true }],
    ['character_guiying', 'stats', getMaDashuaiCharacterHitPointStats('character_guiying')],
    ['character_wu', 'identity', {
      role: '维多利亚老板',
      description: '吴总经营维多利亚，习惯用金钱、职位和生意方式解决问题。开场时他刚见到投奔范德彪的小翠，之后会逐渐追求她并卷入她与钢子的关系。',
      personality: ['圆滑', '体面', '现实', '有控制欲'],
      knowledgeBoundary: ['知道范德彪带来外甥女小翠', '不知道小翠未来会爱上钢子', '不了解马家堡子的彩礼细节'],
    }],
    ['character_wu', 'status', { state: 'active', label: '照看生意', description: '吴总在办公室处理维多利亚的账目和人情往来。', canAct: true }],
    ['character_wu', 'stats', getMaDashuaiCharacterHitPointStats('character_wu')],
    ['character_awei', 'identity', {
      role: '维多利亚工作人员',
      description: '阿薇在维多利亚工作，熟悉场子里的人情规矩。范德彪会误判她的态度并展开追求，但阿薇会明确拒绝。',
      personality: ['清醒', '直接', '独立'],
    }],
    ['character_awei', 'status', { state: 'active', label: '准备上班', description: '阿薇正在后台准备工作，不想掺和范德彪新吹出来的麻烦。', canAct: true }],
    ['character_awei', 'stats', getMaDashuaiCharacterHitPointStats('character_awei')],
    ['character_yu_fugui', 'identity', {
      role: '马家堡子村长',
      description: '余富贵是余德财的父亲和马家堡子村长。小翠婚礼当天逃走让余家丢尽面子，他会在第7集带儿子进城要求马大帅归还三万元彩礼。',
      personality: ['好面子', '精明', '认死理', '顾村里评价'],
    }],
    ['character_yu_fugui', 'status', { state: 'active', label: '等个说法', description: '余富贵留在马家堡子等马大帅回来处理婚事和礼钱。', canAct: true }],
    ['character_yu_fugui', 'stats', getMaDashuaiCharacterHitPointStats('character_yu_fugui')],
    ['character_gangzi', 'identity', {
      role: '小翠的男朋友',
      description: '钢子刚刚出狱，过去为替弟弟报仇而卷入社会恩怨。开场时他尚未认识小翠；第4集会在歌舞厅替她解围，两人才由此相识。',
      personality: ['讲义气', '冲动', '护短', '不服管'],
      knowledgeBoundary: ['知道老疤与弟弟的旧事', '尚未认识小翠和马大帅', '不愿让金钱决定感情'],
    }],
    ['character_gangzi', 'status', { state: 'active', label: '刚刚出狱', description: '钢子刚回到城里，仍惦记与老疤的旧怨，尚未在维多利亚遇见小翠。', canAct: true }],
    ['character_gangzi', 'stats', getMaDashuaiGangziStats()],
    ['character_yu_decai', 'identity', { role: '逃婚事件中的新郎', description: '余富贵的儿子。马大帅未经小翠同意便把她许配给他，婚礼当天小翠逃走。', personality: ['听父亲安排', '在意村里眼光'] }],
    ['character_yu_decai', 'status', { state: 'active', label: '婚礼被逃', description: '余德财留在马家堡子，与父亲一起等待马家给出说法。', canAct: true }],
    ['character_yu_decai', 'stats', getMaDashuaiCharacterHitPointStats('character_yu_decai')],
    ['character_niu_er', 'identity', { role: '玉芬的前夫', description: '牛二长期纠缠并殴打玉芬。玉芬为躲避他才在第4集进城；第13集他再次将玉芬打成重伤。', personality: ['蛮横', '控制欲强', '欺软怕硬'] }],
    ['character_niu_er', 'status', { state: 'active', label: '纠缠玉芬', description: '牛二仍在马家堡子威胁玉芬，尚未把她逼到进城。', canAct: true }],
    ['character_niu_er', 'stats', getMaDashuaiCharacterHitPointStats('character_niu_er')],
    ['character_xiaoyun', 'identity', { role: '小翠在城里的好友', description: '小芸是维多利亚的年轻女孩，第2集与小翠成为朋友，第5集会让躲避父亲的小翠住到自己家。', personality: ['热心', '重朋友', '机灵'] }],
    ['character_xiaoyun', 'status', { state: 'active', label: '尚未认识小翠', description: '小芸正常在城里生活，下一步会在维多利亚结识小翠。', canAct: true }],
    ['character_xiaoyun', 'stats', getMaDashuaiCharacterHitPointStats('character_xiaoyun')],
    ['character_erhu_busker', 'identity', { role: '街头卖艺人', description: '一个装瞎拉二胡的街头卖艺人。第2集马大帅会稀里糊涂跟着他卖艺，并因影响市容受到处罚。', personality: ['油滑', '会看人下菜', '熟悉街头生存'] }],
    ['character_erhu_busker', 'status', { state: 'active', label: '在街头拉二胡', description: '卖艺人正带着二胡在客运站附近寻找生意。', canAct: true }],
    ['character_erhu_busker', 'stats', getMaDashuaiCharacterHitPointStats('character_erhu_busker')],
    ['character_wandering_child', 'identity', { role: '流浪孩子们的代表', description: '马大帅在售票处附近认识的一群流浪孩子中的小头领。第12集他们会跟马大帅讨债并一起进派出所，最终成为办学初心的一部分。', personality: ['机灵', '缺乏安全感', '重情义'] }],
    ['character_wandering_child', 'status', { state: 'active', label: '在车站附近流浪', description: '孩子们还不认识马大帅，夜里常在售票处附近找地方过夜。', canAct: true }],
    ['character_wandering_child', 'stats', getMaDashuaiCharacterHitPointStats('character_wandering_child')],
    ['character_gangzi_brother', 'identity', { role: '钢子的弟弟', description: '钢子的弟弟长期受到毒品控制，他的处境是钢子与老疤仇怨的重要根源。', personality: ['脆弱', '依赖哥哥'] }],
    ['character_gangzi_brother', 'status', { state: 'impaired', label: '受毒品控制', description: '他仍然活着，但状况不断恶化；第22集的死亡尚未发生。', canAct: true }],
    ['character_gangzi_brother', 'stats', getMaDashuaiCharacterHitPointStats('character_gangzi_brother')],
    ['character_lao_ba', 'identity', { role: '钢子的仇人', description: '老疤与钢子及其弟弟有深仇，是后半段绑架小翠和暴力冲突的主要危险人物。', personality: ['狠毒', '记仇', '善于躲藏'] }],
    ['character_lao_ba', 'status', { state: 'active', label: '藏匿行踪', description: '老疤尚未绑架小翠，也没有被钢子打成残疾。', canAct: true }],
    ['character_lao_ba', 'stats', getMaDashuaiCharacterHitPointStats('character_lao_ba')],
    ['character_lao_qian', 'identity', { role: '垂钓园骗局操盘者', description: '老钱擅长把没有基础的项目吹成稳赚生意，会利用范德彪急于成功的虚荣骗走乡亲八万元。', personality: ['圆滑', '夸夸其谈', '投机'] }],
    ['character_lao_qian', 'status', { state: 'active', label: '寻找投资人', description: '老钱尚未向范德彪推销垂钓园项目。', canAct: true }],
    ['character_lao_qian', 'stats', getMaDashuaiCharacterHitPointStats('character_lao_qian')],
    ['character_gao_juzhang', 'identity', { role: '退休干部与陪聊雇主', description: '高局长退休后失落、易怒。马大帅会在第16集起陪他聊天，并用朴实生活态度帮助他重新面对生活。', personality: ['自尊心强', '脾气古怪', '内心孤独'] }],
    ['character_gao_juzhang', 'status', { state: 'active', label: '困在退休失落中', description: '高局长尚未认识马大帅。', canAct: true }],
    ['character_gao_juzhang', 'stats', getMaDashuaiCharacterHitPointStats('character_gao_juzhang')],
    ['character_wang_boss', 'identity', { role: '拳击手父亲与雇主', description: '王老板为受到精神刺激的拳击手儿子寻找陪练，愿意为危险工作支付较高报酬。', personality: ['重视儿子', '讲现实', '肯付报酬'] }],
    ['character_wang_boss', 'status', { state: 'active', label: '照看儿子', description: '王老板尚未在医院遇见马大帅。', canAct: true }],
    ['character_wang_boss', 'stats', getMaDashuaiCharacterHitPointStats('character_wang_boss')],
    ['character_boxer_son', 'identity', { role: '情绪不稳定的拳击手', description: '王老板的儿子受到精神刺激，训练和情绪都不稳定。马大帅会为挣医药费冒险给他当陪练。', personality: ['沉默', '情绪不稳', '力量强'] }],
    ['character_boxer_son', 'status', { state: 'impaired', label: '训练与情绪不稳定', description: '他尚未与马大帅进行陪练。', canAct: true }],
    ['character_boxer_son', 'stats', getMaDashuaiCharacterHitPointStats('character_boxer_son')],
    ['character_su_old_lady', 'identity', { role: '孤独老人', description: '苏老太太性格孤僻、对生活绝望。马大帅会从第23集起照顾她、认她做干妈，并在她去世后继承遗产。', personality: ['孤僻', '敏感', '渴望亲情'] }],
    ['character_su_old_lady', 'status', { state: 'frail', label: '独居且封闭', description: '苏老太太仍然健在，尚未认识马大帅，也尚未立下与他有关的遗嘱。', canAct: true }],
    ['character_su_old_lady', 'stats', getMaDashuaiCharacterHitPointStats('character_su_old_lady')],
    ['item_luggage_bundle', 'identity', { role: 'personal_belongings', description: '马大帅进城时带着的简单行李。钱包和地址被偷后，这是他仅剩的家当。' }],
    ['item_luggage_bundle', 'item', { category: 'tool', stackable: false, droppable: false }],
    ['item_erhu', 'identity', { role: 'performance_tool', description: '装瞎卖艺人的二胡。第2集马大帅会跟着他在街头卖艺；开场时不属于马大帅。', introducedEpisode: 2 }],
    ['item_wooden_pole', 'identity', { role: 'weapon', description: '原本用来挑行李的结实木棍。平时是工具，真到保护自己或家人的时候也能当作临时武器。', weaponCategory: 'improvised melee weapon', damageDice: '1d4', versatileDamageDice: '1d6', damageType: 'bludgeoning', attackAbility: 'strength', proficient: true }],
    ['item_honghua_oil', 'identity', { role: 'consumable', description: '一小瓶红花油，干重活或挨碰以后抹一抹，能暂时缓和疼痛。' }],
    ['item_erhu', 'item', { category: 'tool', stackable: false, droppable: false, use: { type: 'narrative', target: 'optional_character', label: '拉一段二胡' } }],
    ['item_wooden_pole', 'item', { category: 'weapon', stackable: false, droppable: true }],
    ['item_honghua_oil', 'item', { category: 'consumable', stackable: true, droppable: true, use: { type: 'restore_hit_points', target: 'self_or_character', amount: 4, consumeQuantity: 1 } }],
    ['item_lost_wallet', 'identity', { role: 'lost_property', description: '装着马大帅全部盘缠的钱包，已在进城长途车上被扒手偷走。开场时不在任何已知场景。', availability: 'lost', introducedEpisode: 1 }],
    ['item_lost_address', 'identity', { role: 'lost_clue', description: '写着范德彪住址的地址条，与钱包一起遗失。原剧情中没有可供马大帅立即捡回的碎片。', availability: 'lost', introducedEpisode: 1 }],
    ['item_missing_person_notice', 'identity', { role: 'clue', description: '玉芬进城后，范德彪和小翠为寻找失联的马大帅在报纸刊登的寻人启事。', availability: 'future', introducedEpisode: 4 }],
    ['item_counterfeit_note', 'identity', { role: 'evidence', description: '马大帅帮人排队买票时卷入的假钞证物，导致他被误认为参与倒卖假币。', availability: 'future', introducedEpisode: 3 }],
    ['item_detention_release_form', 'identity', { role: 'evidence', description: '范德彪接马大帅离开看守所时办妥的释放手续。', availability: 'future', introducedEpisode: 4 }],
    ['item_victoria_uniform', 'identity', { role: 'work_equipment', description: '小翠在维多利亚歌舞厅做服务员时穿的制服。', availability: 'future', introducedEpisode: 2 }],
    ['item_victoria_badge', 'identity', { role: 'work_token', description: '维多利亚员工工作牌，可证明持有人在歌舞厅、桑拿或餐厅的工作身份。', availability: 'future', introducedEpisode: 2 }],
    ['item_bridal_money_receipt', 'identity', { role: 'evidence', description: '余家交付三万元彩礼的凭据，开场时由余富贵保管。' }],
    ['item_bridal_money_iou', 'identity', { role: 'debt_document', description: '第7集马大帅因无力立即退回彩礼而当面写给余富贵的三万元欠条。', availability: 'future', introducedEpisode: 7 }],
    ['item_wu_cash', 'identity', { role: 'quest_fund', description: '吴总为帮助小翠退婚、争取她好感而交给范德彪的三万元现金。', availability: 'future', introducedEpisode: 7 }],
    ['item_restaurant_apron', 'identity', { role: 'work_equipment', description: '马大帅在维多利亚餐厅当杂工、送盒饭时使用的围裙。', availability: 'future', introducedEpisode: 9 }],
    ['item_debt_ledger', 'identity', { role: 'work_document', description: '范德彪让失业的马大帅替公司追讨欠款时交给他的账册。', availability: 'future', introducedEpisode: 11 }],
    ['item_hospital_bill', 'identity', { role: 'debt_document', description: '玉芬被牛二打成重伤后的住院和治疗费用单据。', availability: 'future', introducedEpisode: 13 }],
    ['item_debiao_resignation', 'identity', { role: 'employment_document', description: '范德彪为试探吴总是否挽留自己而递交、却被当场批准的辞职书。', availability: 'future', introducedEpisode: 16 }],
    ['item_fishing_contract', 'identity', { role: 'fraud_contract', description: '范德彪代表乡亲与老钱签订的垂钓园投资合同，八万元会随合同交给老钱。', availability: 'future', introducedEpisode: 21 }],
    ['item_villager_fund_ledger', 'identity', { role: 'fund_ledger', description: '记录马家堡子乡亲东拼西凑八万元集资款的账册。', availability: 'future', introducedEpisode: 20 }],
    ['item_boxing_gloves', 'identity', { role: 'work_equipment', description: '王老板拳击训练室的陪练护具，并不足以让马大帅免受重击。', availability: 'future', introducedEpisode: 18 }],
    ['item_tricycle', 'identity', { role: 'work_vehicle', description: '创业失败、身无分文的范德彪在第24集用来拉客糊口的三轮车。', availability: 'future', introducedEpisode: 24 }],
    ['item_gangzi_surrender_record', 'identity', { role: 'legal_document', description: '钢子打伤老疤后听从马大帅劝告主动投案形成的记录。', availability: 'future', introducedEpisode: 25 }],
    ['item_pregnancy_report', 'identity', { role: 'medical_document', description: '第26集小翠确认自己已经怀孕的检查报告。', availability: 'future', introducedEpisode: 26 }],
    ['item_su_will', 'identity', { role: 'legal_document', description: '苏老太太去世后留下的遗嘱，指定马大帅继承五十余万元。', availability: 'future', introducedEpisode: 27 }],
    ['item_inheritance_certificate', 'identity', { role: 'quest_fund', description: '苏老太太五十余万元遗产的证明，马大帅最终会把几乎全部遗产投入打工子弟小学。', availability: 'future', introducedEpisode: 27 }],
    ['item_school_ledger', 'identity', { role: 'school_document', description: '记录打工子弟小学全部投入与开支的账本，学校成立前尚不存在。', availability: 'future', introducedEpisode: 27 }],
    ['item_debiao_business_card', 'identity', { role: 'clue', description: '范德彪印得十分气派的名片，写着维多利亚地址和夸张头衔。马大帅原本掌握的地址已经丢失，不能在开场凭空获得此名片。', availability: 'future' }],
    ['faction_ma_family', 'identity', { role: 'faction', description: '围绕马大帅、小翠、玉芬和范德彪形成的亲友关系。开场时众人分散在城乡两地，尚未团聚。', goal: '在冲突与误会中维持亲情并承担各自责任。' }],
    ['faction_victoria', 'identity', { role: 'faction', description: '吴总经营的维多利亚娱乐广场及其员工、保镖与生意关系。', goal: '维持经营、秩序与吴总的个人体面。' }],
    ['faction_villagers', 'identity', { role: 'faction', description: '马家堡子乡亲重视面子与承诺，后来会因相信范德彪而拿出八万元参与垂钓园项目。', goal: '进城找工作并改善生活。' }],
    ['faction_wandering_children', 'identity', { role: 'faction', description: '在客运站和街头四处流浪的孩子们，缺少稳定住处与受教育机会。', goal: '找到安全住处、食物和上学机会。' }],
    ['faction_police', 'identity', { role: 'faction', description: '处理假钞、街头卖艺、讨债胡闹、绑架和钢子投案等事件的城市公安。', goal: '依法处理城市治安案件。' }],
    ['faction_oldscar_group', 'identity', { role: 'faction', description: '围绕老疤形成的危险社会关系，是钢子旧怨和小翠绑架事件的来源。', goal: '逃避追查并报复钢子。' }],
    ['lore_runaway_wedding', 'identity', { role: 'campaign_lore', description: '马大帅没有征求小翠意见便把她许配给余德财，小翠在婚礼当天逃进城投奔范德彪。' }],
    ['lore_bridal_money', 'identity', { role: 'campaign_lore', description: '余家为婚事给出三万元彩礼。马大帅第7集写下欠条，吴总随后出钱让范德彪回村退婚。' }],
    ['lore_yufen_niu_er', 'identity', { role: 'campaign_lore', description: '玉芬长期受前夫牛二纠缠和殴打。她因躲避牛二于第4集进城，第13集又被牛二打成重伤。' }],
    ['lore_wu_xiaocui', 'identity', { role: 'campaign_lore', description: '吴总从第2集起追求小翠，提供工作、职位与退婚资金；小翠早期只感激他，后来爱上钢子。' }],
    ['lore_gangzi_oldscar', 'identity', { role: 'campaign_lore', description: '钢子过去为弟弟报仇入狱，与老疤的仇怨一直没有结束，最终导致小翠被绑架和钢子投案。' }],
    ['lore_debiao_vanity', 'identity', { role: 'campaign_lore', description: '范德彪靠保镖身份和吹牛维持体面，误判阿薇与玉芬的感情，也因急于成功轻信老钱。' }],
    ['lore_fishing_scam', 'identity', { role: 'campaign_lore', description: '老钱用荒坑包装垂钓园项目，范德彪未经核实便让乡亲集资八万元，最终被骗。' }],
    ['lore_wandering_children', 'identity', { role: 'campaign_lore', description: '马大帅在车站认识流浪孩子，又带他们讨债。他与孩子们的感情最终促成创办打工子弟小学。' }],
    ['lore_su_inheritance', 'identity', { role: 'campaign_lore', description: '马大帅照顾孤独的苏老太太并认她为干妈。老太太去世后留下五十余万元，成为办学资金。' }],
    ['lore_realism_tone', 'identity', { role: 'campaign_lore', description: '本世界遵循东北小人物现实喜剧基调：没有魔法、超能力或玄幻设定。人物不应被写成单纯好人或恶人，冲突来自贫穷、面子、误会、家庭责任和城市生活压力；叙事可以幽默，但不能嘲弄弱者。' }],
    ['quest_main', 'quest', { status: 'active', phaseStatus: 'episode_1', title: '马大帅进城寻女', description: '从第1集进城寻女开始，经历找人、退婚、谋生、照顾亲友、垂钓园骗局和创办学校。', objectives: [{ text: '在钱包和地址被偷后设法活下来', status: 'active' }, { text: '找到范德彪并恢复与家人的联系', status: 'pending' }, { text: '找到小翠并听她说明逃婚原因', status: 'pending' }, { text: '处理三万元彩礼与婚约', status: 'locked' }, { text: '在城里谋生并照顾玉芬', status: 'locked' }, { text: '帮助范德彪和乡亲面对垂钓园骗局', status: 'locked' }, { text: '营救小翠并劝钢子投案', status: 'locked' }, { text: '将遗产用于创办打工子弟小学', status: 'locked' }], currentGuidance: '马大帅身在客运站附近，钱包和范德彪地址已经被偷。先解决今晚的吃住，再从街头消息中寻找范德彪。' }],
    ['quest_survive_city', 'quest', { status: 'active', phaseStatus: 'available', episodeRange: '1—4', title: '身无分文在城里活下来', description: '在客运站附近找食物和过夜处，经历街头卖艺、排队买票与假钞误会，并设法从看守所脱身。', nextSceneId: 'scene_city_street' }],
    ['quest_find_debiao', 'quest', { status: 'active', phaseStatus: 'available', episodeRange: '1—4', title: '寻找范德彪', description: '钱包和范德彪地址都已丢失。开场不能直接知道维多利亚位置，需要通过街头消息、卖艺人或后续寻人启事恢复联系。', nextSceneId: 'scene_city_street' }],
    ['quest_find_xiaocui', 'quest', { status: 'inactive', phaseStatus: 'hidden', episodeRange: '4—5', title: '父女见面', description: '马大帅获释后追问小翠下落；小翠躲到小芸家，最终明确拒绝原有婚事。', nextSceneId: 'scene_xiaoyun_home' }],
    ['quest_cancel_marriage', 'quest', { status: 'inactive', phaseStatus: 'locked', episodeRange: '6—8', title: '退婚与三万元彩礼', description: '马大帅决定退回彩礼，余富贵进城讨说法，吴总最终拿出三万元由范德彪回村处理退婚。', nextSceneId: 'scene_majia_village' }],
    ['quest_city_jobs', 'quest', { status: 'inactive', phaseStatus: 'locked', episodeRange: '6—24', title: '马大帅的谋生经历', description: '依次经历搓澡工、餐厅杂工、送盒饭、讨债、陪高局长聊天、拳击陪练和照顾苏老太太等工作。', nextSceneId: 'scene_bathhouse' }],
    ['quest_yufen_niu_er', 'quest', { status: 'inactive', phaseStatus: 'available', episodeRange: '1—23', title: '保护玉芬摆脱牛二', description: '玉芬仍在村里受牛二纠缠。她会进城寻找马大帅，后来再次遭牛二重伤并产生高额医药费。', nextSceneId: 'scene_majia_village' }],
    ['quest_xiaocui_relationship', 'quest', { status: 'inactive', phaseStatus: 'hidden', episodeRange: '2—27', title: '小翠的感情选择', description: '记录吴总的追求、小翠与钢子的相识相爱、钢子投案、小翠怀孕以及最终决定。任何变化必须尊重小翠当前选择。', nextSceneId: 'scene_victoria' }],
    ['quest_debiao_business', 'quest', { status: 'inactive', phaseStatus: 'hidden', episodeRange: '8—25', title: '范德彪的发财梦', description: '范德彪先对乡亲夸口，后轻信老钱并骗入八万元集资，最终骑三轮谋生并回到桂英饭店当厨师。', nextSceneId: 'scene_fishing_park' }],
    ['quest_gangzi_revenge', 'quest', { status: 'inactive', phaseStatus: 'hidden', episodeRange: '10—26', title: '钢子与老疤', description: '钢子在爱情与旧怨间挣扎，弟弟死亡后再次复仇，最终营救小翠、打伤老疤并投案。', nextSceneId: 'scene_oldscar_hideout' }],
    ['quest_wandering_children', 'quest', { status: 'inactive', phaseStatus: 'hidden', episodeRange: '2—27', title: '流浪孩子们', description: '马大帅在车站认识流浪孩子，后来认作干儿子并最终为他们创办学校。', nextSceneId: 'scene_bus_station' }],
    ['quest_su_old_lady', 'quest', { status: 'inactive', phaseStatus: 'hidden', episodeRange: '23—27', title: '照顾苏老太太', description: '以真诚陪伴孤独的苏老太太，认她做干妈，经历她的离世和遗产安排。', nextSceneId: 'scene_su_home' }],
    ['quest_build_school', 'quest', { status: 'inactive', phaseStatus: 'hidden', episodeRange: '27', title: '创办打工子弟小学', description: '把苏老太太留下的五十余万元几乎全部投入学校，让流浪儿童和务工者孩子有书可读。', nextSceneId: 'scene_migrant_school' }],
  ];
  for (const [entityId, type, data] of components) upsertComponent(entityId, type, data);

  const relationships = [
    ['player', 'scene_bus_station', 'located_in', null, '马大帅刚在客运站发现钱包和范德彪地址被偷。'],
    ['character_yufen', 'scene_majia_village', 'located_in', null, '玉芬开场仍在马家堡子，尚未进城。'],
    ...MA_DASHUAI_VICTORIA_CHARACTER_LOCATIONS,
    ['character_guiying', 'scene_guiying_restaurant', 'located_in', null, '桂英在自己的饭店经营生意，尚未进入范德彪的感情线。'],
    ['character_yu_fugui', 'scene_majia_village', 'located_in', null, '余富贵和儿子留在村里等马家给逃婚一个说法。'],
    ['character_yu_decai', 'scene_majia_village', 'located_in', null, '余德财的婚礼被小翠逃掉，仍留在村里。'],
    ['character_niu_er', 'scene_majia_village', 'located_in', null, '牛二仍在村里纠缠玉芬。'],
    ['character_gangzi', 'scene_city_street', 'located_in', null, '钢子刚刚出狱，尚未认识小翠。'],
    ['character_xiaoyun', 'scene_xiaoyun_home', 'located_in', null, '小芸尚未在维多利亚结识小翠。'],
    ['character_erhu_busker', 'scene_city_street', 'located_in', null, '装瞎卖艺人正在客运站附近拉二胡。'],
    ['character_wandering_child', 'scene_bus_station', 'located_in', null, '流浪孩子们常在售票处附近过夜。'],
    ['character_gangzi_brother', 'scene_city_street', 'located_in', null, '钢子的弟弟仍在城里受毒品控制。'],
    ['character_lao_ba', 'scene_oldscar_hideout', 'located_in', null, '老疤藏着行踪，尚未绑架小翠。'],
    ['character_lao_qian', 'scene_city_street', 'located_in', null, '老钱正在寻找可以相信垂钓园项目的投资人。'],
    ['character_gao_juzhang', 'scene_gao_home', 'located_in', null, '高局长退休后独自在家消沉。'],
    ['character_wang_boss', 'scene_wang_boxing_room', 'located_in', null, '王老板正在照看状态不稳的拳击手儿子。'],
    ['character_boxer_son', 'scene_wang_boxing_room', 'located_in', null, '王老板的儿子仍在训练，尚未认识马大帅。'],
    ['character_su_old_lady', 'scene_su_home', 'located_in', null, '苏老太太独居且封闭，尚未认识马大帅。'],
    ['player', 'item_luggage_bundle', 'ownership', null, '马大帅的钱包被偷后，只剩这包随身行李。'],
    ['player', 'item_wooden_pole', 'ownership', null, '马大帅用一根木棍挑着行李进城。'],
    ['player', 'item_honghua_oil', 'ownership', null, '马大帅带着两份干活受伤时用的红花油。', { quantity: 2 }],
    ['character_erhu_busker', 'item_erhu', 'ownership', null, '二胡属于装瞎卖艺人，不是马大帅的初始物品。'],
    ['character_yu_fugui', 'item_bridal_money_receipt', 'ownership', null, '余富贵保管三万元彩礼凭据。'],
    ['player', 'item_lost_wallet', 'related_to', null, '钱包已经被扒手偷走，开场不可从背包或车站直接取回。', { state: 'lost' }],
    ['player', 'item_lost_address', 'related_to', null, '范德彪地址已经遗失，开场不能直接获知维多利亚位置。', { state: 'lost' }],
    ['scene_bus_station', 'scene_city_street', 'exit_to', null, '从客运站出口进入城里街面。'],
    ['scene_city_street', 'scene_bus_station', 'exit_to', null, '沿街向西可以回到客运站。'],
    ['scene_city_street', 'scene_victoria', 'exit_to', null, '查到地址或得到明确指引后才能找到维多利亚。'],
    ['scene_victoria', 'scene_city_street', 'exit_to', null, '维多利亚正门通向城里街面。'],
    ['scene_city_street', 'scene_debiao_home', 'exit_to', null, '找到范德彪住址后可以从街面前往他的住处。'],
    ['scene_debiao_home', 'scene_city_street', 'exit_to', null, '范德彪住处外通往城里街面。'],
    ['scene_debiao_home', 'scene_victoria', 'exit_to', null, '范德彪往返住处与维多利亚上班。'],
    ['scene_victoria', 'scene_debiao_home', 'exit_to', null, '维多利亚外可以返回范德彪住处。'],
    ['scene_debiao_home', 'scene_xiaoyun_home', 'exit_to', null, '跟踪范德彪或得到小芸地址后可以找到小翠藏身处。'],
    ['scene_xiaoyun_home', 'scene_debiao_home', 'exit_to', null, '小芸住处可以返回范德彪家。'],
    ['scene_xiaoyun_home', 'scene_city_street', 'exit_to', null, '小芸住处外通往城里街面。'],
    ['scene_city_street', 'scene_detention_center', 'exit_to', null, '假钞误会发生后，马大帅会被带往看守所。'],
    ['scene_detention_center', 'scene_city_street', 'exit_to', null, '办妥释放手续后可离开看守所。'],
    ...MA_DASHUAI_VICTORIA_INTERNAL_EXITS,
    ['scene_victoria', 'scene_victoria_restaurant', 'exit_to', null, '维多利亚内部通往餐厅。'],
    ['scene_victoria_restaurant', 'scene_victoria', 'exit_to', null, '餐厅属于维多利亚内部区域。'],
    ['scene_victoria_restaurant', 'scene_city_street', 'exit_to', null, '送盒饭时可从餐厅直接进入城里街面。'],
    ['scene_victoria', 'scene_bathhouse', 'exit_to', null, '维多利亚内部通往桑拿浴室。'],
    ['scene_bathhouse', 'scene_victoria', 'exit_to', null, '桑拿浴室出口回到维多利亚。'],
    ['scene_victoria', 'scene_bar', 'exit_to', null, '从维多利亚可前往吴总约钢子谈判的酒吧。'],
    ['scene_bar', 'scene_city_street', 'exit_to', null, '酒吧外回到城里街面。'],
    ['scene_bar', 'scene_victoria', 'exit_to', null, '吴总可以从酒吧返回维多利亚。'],
    ['scene_city_street', 'scene_guiying_restaurant', 'exit_to', null, '知道桂英饭店后可以从街面前往。'],
    ['scene_guiying_restaurant', 'scene_city_street', 'exit_to', null, '桂英饭店门外回到城里街面。'],
    ['scene_guiying_restaurant', 'scene_debiao_home', 'exit_to', null, '桂英与范德彪关系发展后可往返他的住处。'],
    ['scene_city_street', 'scene_hospital', 'exit_to', null, '牛二打伤玉芬后需要前往市医院。'],
    ['scene_hospital', 'scene_city_street', 'exit_to', null, '医院门外通往城里街面。'],
    ['scene_hospital', 'scene_debiao_home', 'exit_to', null, '出院或探望结束后可以回范德彪住处。'],
    ['scene_city_street', 'scene_gao_home', 'exit_to', null, '接受陪聊工作后可以前往高局长家。'],
    ['scene_gao_home', 'scene_city_street', 'exit_to', null, '高局长家外回到街面。'],
    ['scene_hospital', 'scene_wang_boxing_room', 'exit_to', null, '在医院认识王老板后可前往拳击训练室。'],
    ['scene_wang_boxing_room', 'scene_hospital', 'exit_to', null, '陪练受伤后可以直接前往医院。'],
    ['scene_wang_boxing_room', 'scene_city_street', 'exit_to', null, '拳击训练室外回到城里。'],
    ['scene_city_street', 'scene_fishing_park', 'exit_to', null, '老钱带范德彪考察后才会知道垂钓园荒坑位置。'],
    ['scene_fishing_park', 'scene_city_street', 'exit_to', null, '从垂钓园荒坑返回城里。'],
    ['scene_fishing_park', 'scene_majia_village', 'exit_to', null, '垂钓园骗局与马家堡子乡亲的集资相连。'],
    ['scene_majia_village', 'scene_fishing_park', 'exit_to', null, '乡亲可以从村里前往考察垂钓园项目。'],
    ['scene_city_street', 'scene_su_home', 'exit_to', null, '接受照顾工作后可以前往苏老太太家。'],
    ['scene_su_home', 'scene_city_street', 'exit_to', null, '苏老太太家外回到城里街面。'],
    ['scene_city_street', 'scene_oldscar_hideout', 'exit_to', null, '查明小翠被绑位置后才能前往老疤藏身处。'],
    ['scene_oldscar_hideout', 'scene_city_street', 'exit_to', null, '警方救援后可从郊外返回城里。'],
    ['scene_city_street', 'scene_jail_visiting_room', 'exit_to', null, '钢子投案后可办理探监前往会见室。'],
    ['scene_jail_visiting_room', 'scene_city_street', 'exit_to', null, '会见结束后返回城里。'],
    ['scene_city_street', 'scene_majia_village', 'exit_to', null, '乘长途车可以往返马家堡子。'],
    ['scene_majia_village', 'scene_city_street', 'exit_to', null, '村口长途车通往城里。'],
    ['scene_city_street', 'scene_migrant_school', 'exit_to', null, '学校真正创办后才会成为可进入场景。'],
    ['scene_migrant_school', 'scene_city_street', 'exit_to', null, '学校外通往城里。'],
    ['character_yufen', 'player', 'trust', 55, '玉芬了解马大帅的实在，也担心他为了面子逞强。'],
    ['character_yufen', 'player', 'affinity', 20, '开场时马大帅心仪玉芬，双方感情尚未在城里明确。'],
    ['character_ma_xiaocui', 'player', 'trust', 15, '小翠爱父亲，但因被擅自安排婚姻而不敢直接面对他。'],
    ['character_fan_debiao', 'player', 'trust', 35, '范德彪嘴上埋怨姐夫，遇到真事还是愿意帮忙。'],
    ['character_yu_fugui', 'player', 'hostility', 35, '小翠婚礼当天逃走，余富贵要求马大帅和彩礼给出交代。'],
    ['character_niu_er', 'character_yufen', 'hostility', 80, '牛二持续控制、纠缠并伤害前妻玉芬。'],
    ['character_fan_debiao', 'character_awei', 'affinity', 15, '范德彪已经对阿薇有好感，但尚未正式追求。'],
    ['character_gangzi', 'character_lao_ba', 'hostility', 75, '钢子因弟弟和旧日恩怨一直在寻找老疤。'],
    ['character_gangzi', 'character_gangzi_brother', 'trust', 85, '钢子十分在意弟弟，也容易因此再次走向报复。'],
    ['character_yufen', 'faction_ma_family', 'belongs_to', null, '玉芬是马家亲友的重要支柱。'],
    ['character_fan_debiao', 'faction_ma_family', 'belongs_to', null, '范德彪是小翠的舅舅。'],
    ['character_ma_xiaocui', 'faction_ma_family', 'belongs_to', null, '小翠是马大帅的女儿。'],
    ['character_fan_debiao', 'faction_victoria', 'belongs_to', null, '范德彪在维多利亚当保镖。'],
    ['character_wu', 'faction_victoria', 'belongs_to', null, '吴总是维多利亚老板。'],
    ['character_awei', 'faction_victoria', 'belongs_to', null, '阿薇在维多利亚工作。'],
    ['character_yu_fugui', 'faction_villagers', 'belongs_to', null, '余富贵代表马家堡子的乡情和压力。'],
    ['character_yu_decai', 'faction_villagers', 'belongs_to', null, '余德财是逃婚事件中的新郎。'],
    ['character_niu_er', 'faction_villagers', 'belongs_to', null, '牛二仍活动在马家堡子。'],
    ['character_wandering_child', 'faction_wandering_children', 'belongs_to', null, '他代表客运站附近的流浪孩子们。'],
    ['character_lao_ba', 'faction_oldscar_group', 'belongs_to', null, '老疤是一伙人的核心。'],
    ['quest_main', 'quest_survive_city', 'requires', null, '马大帅首先要在身无分文的状态下活下来。'],
    ['quest_main', 'quest_find_debiao', 'requires', null, '恢复与范德彪的联系才能找到小翠。'],
    ['quest_main', 'quest_find_xiaocui', 'requires', null, '父女见面是处理逃婚的前提。'],
    ['quest_main', 'quest_cancel_marriage', 'requires', null, '马大帅必须面对三万元彩礼和退婚。'],
    ['quest_main', 'quest_city_jobs', 'requires', null, '进城后的生计串联起医药费和家庭责任。'],
    ['quest_main', 'quest_debiao_business', 'requires', null, '范德彪的垂钓园骗局造成后半段债务。'],
    ['quest_main', 'quest_gangzi_revenge', 'requires', null, '钢子与老疤的旧怨最终危及小翠。'],
    ['quest_build_school', 'quest_wandering_children', 'requires', null, '马大帅与流浪孩子的感情是办学初心。'],
    ['quest_build_school', 'quest_su_old_lady', 'requires', null, '苏老太太的遗产提供办学资金。'],
    ['quest_build_school', 'scene_migrant_school', 'unlocks', null, '第27集完成办学后学校才真正存在。'],
    ['scene_majia_village', 'lore_runaway_wedding', 'mentions', null, '马家堡子保留着逃婚事件的全部后果。'],
    ['scene_majia_village', 'lore_bridal_money', 'mentions', null, '三万元彩礼是马家和余家之间的现实债务。'],
    ['scene_victoria', 'lore_wu_xiaocui', 'mentions', null, '吴总与小翠的关系会从维多利亚开始。'],
    ['scene_fishing_park', 'lore_fishing_scam', 'mentions', null, '荒坑是垂钓园骗局的核心证据。'],
    ['scene_bus_station', 'lore_wandering_children', 'mentions', null, '马大帅会在售票处附近认识流浪孩子。'],
    ['scene_su_home', 'lore_su_inheritance', 'mentions', null, '苏老太太家承载陪伴、离世与遗产线。'],
    ['player', 'lore_yufen_niu_er', 'knows', null, '马大帅进城前亲眼见到牛二纠缠殴打玉芬。'],
    ['character_ma_xiaocui', 'lore_runaway_wedding', 'knows', null, '小翠最清楚自己为什么逃婚。'],
    ['character_yu_fugui', 'lore_bridal_money', 'knows', null, '余富贵掌握礼钱和婚约的具体情况。'],
    ['character_gangzi', 'lore_gangzi_oldscar', 'knows', null, '钢子知道自己与老疤、弟弟之间的全部旧怨。'],
    ['character_lao_qian', 'lore_fishing_scam', 'knows', null, '老钱知道垂钓园项目并不可靠。'],
  ];

  for (const [sourceId, targetId, type, value, summary, data = {}] of relationships) {
    upsertRelationship(sourceId, targetId, type, value, { source: 'seed', summary, ...data });
  }

  setMeta('playerId', 'player');
  setMeta('currentSceneId', 'scene_bus_station');
  setMeta('campaignId', MA_DASHUAI_CAMPAIGN_ID);
  setMeta('campaignTitle', '马大帅：进城以后');
  setMeta('campaignDay', '1');
  setMeta('campaignEpisode', '1');
  setMeta('campaignArc', '第1—9集：马大帅进城寻女');
  setMeta('storyCheckpoint', '第1集：马大帅在城市客运站发现钱包和范德彪地址被偷，尚未找到任何亲友。');
  setMeta('presetRevision', MA_DASHUAI_PRESET_REVISION);
  setMeta('inventory.items.v1', 'ready');
  addEvent('world.seeded', null, null, { summary: '按《马大帅》第一部第1集开场初始化预制世界：马大帅进城寻女，钱包和地址刚被偷。' });
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
    upsertEntity('item_luggage_bundle', 'item', '随身行李');
    upsertEntity('item_wooden_pole', 'item', '行李木棍');
    upsertEntity('item_erhu', 'item', '卖艺二胡');
    upsertEntity('item_honghua_oil', 'item', '红花油');
    setAliases('player', ['玩家', '老马', '大帅', '马叔', '马校长']);
    setAliases('item_wooden_pole', ['木棍', '挑行李的木棍', '棍子']);
    setAliases('item_honghua_oil', ['药油', '红花油', '跌打药']);
    setAliases('item_luggage_bundle', ['行李', '包袱', '随身行李']);
    mergeComponentDefaults('player', 'identity', {
      role: '进城寻找女儿的农民',
      description: '玩家扮演马大帅。小翠逃婚进城后，他来城里找女儿，却在长途车上丢了钱包和地址。',
      class: 'civilian',
      level: 1,
    });
    applyStatsProfile('player', getMaDashuaiPlayerStats(), MA_DASHUAI_PLAYER_PROFILE_ID, ['maxHitPoints', 'currentHitPoints']);
    mergeComponentDefaults('player', 'status', {
      state: 'healthy',
      label: '进城寻女，身无分文',
      description: '马大帅刚下长途车便发现钱包和范德彪地址都被偷走，只剩随身行李。',
      canAct: true,
    });
    mergeInventoryDefaults('player', {
      items: ['item_luggage_bundle', 'item_wooden_pole'],
    });
    mergeComponentDefaults('item_luggage_bundle', 'identity', {
      role: 'personal_belongings',
      description: '马大帅进城时带着的简单行李。钱包和地址被偷后，这是他仅剩的家当。',
    });
    mergeComponentDefaults('item_luggage_bundle', 'item', {
      category: 'tool',
      stackable: false,
      droppable: false,
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
      role: 'performance_tool',
      description: '装瞎卖艺人的二胡。马大帅第2集会跟着他卖艺，但这不是马大帅的初始物品。',
      introducedEpisode: 2,
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
    const luggageHasOwner = listRelationships({ entityId: 'item_luggage_bundle', direction: 'in', type: 'ownership' }).length > 0;
    if (!luggageHasOwner) {
      upsertRelationship('player', 'item_luggage_bundle', 'ownership', null, { source: 'baseline', summary: '马大帅的钱包被偷后，只剩这包随身行李。' });
    }
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

  for (const [entityId, maxHitPoints] of Object.entries(MA_DASHUAI_CHARACTER_HIT_POINTS)) {
    if (entityId === 'character_yufen' || entityId === 'character_gangzi' || !getEntity(entityId)) continue;
    applyStatsProfile(entityId, { maxHitPoints, currentHitPoints: maxHitPoints }, `ma-dashuai-${entityId}-v1`, ['maxHitPoints', 'currentHitPoints']);
  }

  if (!getMeta('presetRevision', '')) {
    setMeta('presetRevision', MA_DASHUAI_PRESET_REVISION);
  }
}
