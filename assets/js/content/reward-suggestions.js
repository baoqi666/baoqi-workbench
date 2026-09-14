/* ============================================================
  系统奖励推荐池：每日由日期种子选取若干条，供用户「选择性纳入」个人奖励库
  积分规则：累计专注每 60 分钟得 1 分（与奖励兑换一致）
  字段：id 稳定标识 / name 名称 / cost 每次兑换消耗积分
  ============================================================ */
(function (global) {
 window.RewardSuggestions = [
  { id: 'r01', name: '一杯奶茶', cost: 30 },
  { id: 'r02', name: '看一集喜欢的剧', cost: 20 },
  { id: 'r03', name: '睡个自然醒的懒觉', cost: 25 },
  { id: 'r04', name: '吃顿好吃的', cost: 60 },
  { id: 'r05', name: '买一本喜欢的书', cost: 50 },
  { id: 'r06', name: '周末短途出游', cost: 120 },
  { id: 'r07', name: '按摩 / 肩颈放松', cost: 80 },
  { id: 'r08', name: '入手一个小游戏', cost: 90 },
  { id: 'r09', name: '撸猫撸狗时间', cost: 15 },
  { id: 'r10', name: '泡个热水澡', cost: 20 },
  { id: 'r11', name: '听一场音乐会', cost: 100 },
  { id: 'r12', name: '买束鲜花装点房间', cost: 30 },
  { id: 'r13', name: '给自己放半天假', cost: 70 },
  { id: 'r14', name: '新口红 / 护肤品', cost: 60 },
  { id: 'r15', name: '一场电影', cost: 45 },
  { id: 'r16', name: '升级一下装备', cost: 110 },
  { id: 'r17', name: '一顿精致 Brunch', cost: 55 },
  { id: 'r18', name: '去咖啡馆虚度下午', cost: 35 },
  { id: 'r19', name: '订阅一个喜欢的会员', cost: 40 },
  { id: 'r20', name: '做手工 / 拼图一下午', cost: 25 },
  { id: 'r21', name: '买盆绿植', cost: 30 },
  { id: 'r22', name: '约朋友聚聚', cost: 50 },
  { id: 'r23', name: '深夜宵夜', cost: 30 },
  { id: 'r24', name: '一次短途骑行', cost: 40 },
  { id: 'r25', name: '买张喜欢的专辑', cost: 25 },
  { id: 'r26', name: '躺平刷会儿短视频', cost: 15 },
  { id: 'r27', name: '尝试一家新餐厅', cost: 65 },
  { id: 'r28', name: '报个兴趣课', cost: 130 },
  { id: 'r29', name: '一套新运动服', cost: 90 },
  { id: 'r30', name: '拍一组写真', cost: 120 },
  { id: 'r31', name: '看一场话剧 / 展览', cost: 80 },
  { id: 'r32', name: '给自己写封信', cost: 10 }
 ];
})(window);
