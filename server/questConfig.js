export const QUEST_JUDGE_INITIALIZED_META_KEY = 'questJudge.initialized.v1';
export const QUEST_JUDGE_CONVERSATION_CURSOR_META_KEY = 'questJudge.conversationCursor';
export const QUEST_JUDGE_EVENT_CURSOR_META_KEY = 'questJudge.eventCursor';

export const MA_DASHUAI_QUEST_JUDGE_DEFAULTS = Object.freeze({
  quest_survive_city: Object.freeze({
    judgeEnabled: true,
    questLogVisible: true,
    displayOrder: 1,
    completionCriteria: '马大帅已经实际解决眼前的吃饭和过夜问题，或获得一份足以维持近期基本生存的可靠安排。仅仅离开客运站、打听消息、提出计划，或只解决吃住中的一项，不算完成。',
    progressSummary: '刚到城里，钱包和地址都已丢失，吃饭与过夜仍没有着落。',
    onComplete: { activateQuestIds: [] },
  }),
  quest_find_debiao: Object.freeze({
    judgeEnabled: true,
    questLogVisible: true,
    displayOrder: 2,
    completionCriteria: '马大帅已经与范德彪本人见面，并且双方在对话或行动中明确确认了彼此身份。只获得地址、听到线索、远远看见他，或由第三人声称找到了他，都不算完成。',
    progressSummary: '范德彪的地址已经随钱包丢失，马大帅还没有找到本人。',
    onComplete: { activateQuestIds: ['quest_find_xiaocui'] },
  }),
  quest_find_xiaocui: Object.freeze({
    judgeEnabled: true,
    questLogVisible: true,
    displayOrder: 3,
    completionCriteria: '马大帅已经与小翠本人直接交谈，并且小翠亲口说明自己逃婚或反对原有婚事的真实态度。仅仅来到同一场景、看见小翠，或从范德彪等第三人处听说她的想法，都不算完成。',
    progressSummary: '父女尚未见面，马大帅也还没有听到小翠对逃婚和婚事的亲口解释。',
    onComplete: { activateQuestIds: ['quest_cancel_marriage'] },
  }),
});
