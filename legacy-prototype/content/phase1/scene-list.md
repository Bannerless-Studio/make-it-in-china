# Phase 1 scene list

This M0 curriculum has exactly 25 scenes. `S00`–`S24` are shorthand for the full IDs below.
S01–S03 are the implemented vertical slice; their consequence branches are implementation
scenes rather than additional curriculum scenes. Planned scenes have 4–6 exchanges, jobs 4
or 5. The `New words by exchange` column keeps every exchange at no more than two new words;
exchanges past the ones listed there are review beats that introduce nothing and exist so
each recontextualised word gets its own short line instead of being packed into one.

Scene 00 teaches the ten words required by S01: 你, 好, 我, 是, 这, 那, 一, 二, 三, 四.
Every later `Requires` cell is a subset of words introduced in earlier rows.

| ID | Situation / location | NPC | Kind | Requires | Known used | New words by exchange |
|---|---|---|---|---|---:|---|
| S00 `p1_arrival_00` | Arrival / rented room | landlord | story | — | 0 | e1 你, 好; e2 我, 是; e3 这, 那; e4 一, 二; e5 三, 四 |
| S01 `p1_noodle_dishwasher_01` | First shift: cups and bowls / noodle shop | cook | job | 你, 好, 我, 是, 这, 那, 一, 二, 三, 四 | 10 | e1 工作; e2 杯子, 碗 **(bonus)**; e4 个; e5 做, 几 |
| S02 `p1_noodle_dishwasher_02` | Second shift: drinks / noodle shop | cook | job | 你, 好, 我, 是, 这, 个, 杯子 | 15 | e1 请; e2 水, 茶; e3 喝; e5 六, 八 |
| S03 `p1_noodle_dishwasher_03` | Third shift: stock / noodle shop | cook | job | 你, 我, 水, 茶, 喝, 好 | 11 | e1 有, 米饭; e2 菜; e3 没有; e4 不; e5 吃 |
| S04 `p1_mentor_negatives_01` | Evening: 不 vs 没有 / tea house | mentor | mentor | 不, 没有, 有, 你, 我 | 12 | e1 能, 会; e2 想, 喜欢; e3 很, 太; e4 review |
| S05 `p1_warehouse_porter_01` | Porter: size and box counts / warehouse | warehouse boss | job | 这, 那, 个, 几, 工作, 做 | 12 | e1 大, 小; e2 多少; e3 五, 七; e4 九 |
| S06 `p1_mentor_quantities_02` | Evening: 几 vs 多少 / tea house | mentor | mentor | 几, 多少, 个, 一, 二 | 12 | e1 多, 少; e2 十, 本; e3 书, 读; e4 review |
| S07 `p1_warehouse_porter_02` | Porter: place the goods / warehouse | warehouse boss | job | 这, 那, 大, 小, 个 | 12 | e1 东西, 上; e2 下, 里; e3 看, 看见; e4 review |
| S08 `p1_delivery_directions_01` | Delivery: finding an address / street | delivery boss | job | 这, 那, 上, 下, 里 | 12 | e1 在, 哪儿; e2 前面, 后面; e3 去, 回; e4 火车站 |
| S09 `p1_delivery_names_02` | Delivery: names at the door / street | customer | job | 你, 我, 是, 哪儿, 在 | 13 | e1 家, 名字; e2 叫, 先生; e3 小姐, 她; e4 他 |
| S10 `p1_ask_time_01` | Asking the time / bus stop | customer | errand | 一, 二, 三, 四, 几 | 14 | e1 现在, 点; e2 上午, 中午; e3 下午, 分钟; e4 时候 |
| S11 `p1_wrong_bus_01` | Wrong-bus mix-up / bus stop | customer | consequence | 火车站, 哪儿, 去, 回, 现在 | 14 | e1 出租车, 飞机; e2 北京, 来; e3 开, 坐; e4 对不起<br>时候 coverage moved to S13 e4. |
| S12 `p1_buy_fruit_01` | Buying food / fruit stall | fruit seller | errand | 多少, 个, 水, 米饭, 菜 | 14 | e1 苹果, 水果; e2 买, 钱; e3 块, 商店; e4 些 |
| S13 `p1_pay_rent_01` | Paying rent / rented room | landlord | story | 钱, 块, 家 | 14 | e1 月, 星期; e2 年, 日; e3 住, 的; e4 今天 |
| S14 `p1_landlord_phone_01` | Landlord phone message / rented room | landlord | story | 你, 我, 今天, 现在, 家 | 14 | e1 喂, 打电话; e2 明天, 吗; e3 呢, 冷; e4 下雨 |
| S15 `p1_cook_family_chat_01` | Family small-talk / noodle shop | cook | story | 你, 我, 她, 他, 名字 | 14 | e1 爸爸, 妈妈; e2 儿子, 女儿; e3 朋友, 爱; e4 和 |
| S16 `p1_customer_people_chat_02` | People and work small-talk / noodle shop | customer | story | 朋友, 工作, 名字, 他, 她 | 14 | e1 同学, 老师; e2 医生, 学生; e3 人, 认识; e4 高兴 |
| S17 `p1_mentor_address_03` | Evening: address and courtesy / tea house | mentor | mentor | 你, 他, 她, 老师, 先生, 小姐 | 14 | e1 谁, 什么; e2 说话, 听; e3 我们, 谢谢; e4 不客气 |
| S18 `p1_study_at_home_01` | Studying and devices / rented room | mentor | mentor | 书, 读, 老师, 学生 | 14 | e1 汉语, 学习; e2 写, 字; e3 学校, 电脑; e4 电视 |
| S19 `p1_room_evening_01` | Setting up the room / rented room | landlord | story | 家, 看, 电视, 好 | 14 | e1 椅子, 桌子; e2 衣服, 漂亮; e3 电影, 睡觉; e4 昨天 |
| S20 `p1_weather_lunch_01` | Hot day and lunch / noodle shop | cook | story | 今天, 冷, 下雨, 现在 | 14 | e1 天, 天气; e2 热, 了; e3 没关系; e4 review |
| S21 `p1_clinic_delivery_03` | Clinic delivery / locked clinic door | delivery boss | job | 医生, 人, 现在, 去 | 12 | e1 医院, 怎么; e2 怎么样, 岁; e3 再见; e4 review |
| S22 `p1_street_labels_01` | Reading shop and parcel labels / supermarket | shopkeeper | errand | 看, 字, 商店, 认识 | 10 | e1 狗, 猫; e2 都, 中国; e3 饭店; e4 review |
| S23 `p1_warehouse_review_03` | Repeat porter shift / warehouse | warehouse boss | job | 大, 小, 多少, 上, 下, 在 | 10 | e1–e4 hidden review |
| S24 `p1_noodle_review_04` | Repeat dishwasher shift / noodle shop | cook | job | 杯子, 碗, 水, 茶, 有, 没有 | 12 | e1–e4 hidden review |

The S17 mentor explanation discusses when familiar `你` is appropriate and how respectful
address works; the off-list form `您` is explanation-only and is not introduced or used in
Chinese dialogue. `狗` and `猫` occur on labels and in speech only; no animal characters are
added. S13 e4 supplies the replacement extra placement for `时候` after its S11 placement was
dropped. All scenes stay within the Phase 1 economy and theme limits.

## Coverage

Each word in a `Word(s)` cell appears in all three listed scenes. The two following scenes
recontextualize each introduction, giving every one of the 150 phase-list words three distinct
planned scene appearances.

| Word(s) | Planned scenes | Count |
|---|---|---:|
| 你, 好, 我, 是, 这, 那, 一, 二, 三, 四 | S00, S01, S02 | 3 |
| 工作, 杯子, 个, 做, 几 | S01, S02, S03 | 3 |
| 请, 水, 茶, 喝, 六, 八 | S02, S03, S04 | 3 |
| 有, 米饭, 菜, 没有, 不, 吃 | S03, S04, S05 | 3 |
| 能, 会, 想, 喜欢, 很, 太 | S04, S05, S06 | 3 |
| 大, 小, 多少, 五, 七, 九 | S05, S06, S07 | 3 |
| 多, 少, 十, 本, 书, 读 | S06, S07, S08 | 3 |
| 东西, 上, 下, 里, 看, 看见 | S07, S08, S09 | 3 |
| 在, 哪儿, 前面, 后面, 去, 回, 火车站 | S08, S09, S10 | 3 |
| 家, 名字, 叫, 先生, 小姐, 她, 他 | S09, S10, S11 | 3 |
| 现在, 点, 上午, 中午, 下午, 分钟 | S10, S11, S12 | 3 |
| 时候 | S10, S12, S13 | 3 |
| 出租车, 飞机, 北京, 来, 开, 坐, 对不起 | S11, S12, S13 | 3 |
| 苹果, 水果, 买, 钱, 块, 商店, 些 | S12, S13, S14 | 3 |
| 月, 星期, 年, 日, 住, 的, 今天 | S13, S14, S15 | 3 |
| 喂, 打电话, 明天, 吗, 呢, 冷, 下雨 | S14, S15, S16 | 3 |
| 爸爸, 妈妈, 儿子, 女儿, 朋友, 爱, 和 | S15, S16, S17 | 3 |
| 同学, 老师, 医生, 学生, 人, 认识, 高兴 | S16, S17, S18 | 3 |
| 谁, 什么, 说话, 听, 我们, 谢谢, 不客气 | S17, S18, S19 | 3 |
| 汉语, 学习, 写, 字, 学校, 电脑, 电视 | S18, S19, S20 | 3 |
| 椅子, 桌子, 衣服, 漂亮, 电影, 睡觉, 昨天 | S19, S20, S21 | 3 |
| 天, 天气, 热, 了, 没关系 | S20, S21, S22 | 3 |
| 医院, 怎么, 怎么样, 岁, 再见 | S21, S22, S23 | 3 |
| 狗, 猫, 都, 中国, 饭店 | S22, S23, S24 | 3 |

### Bonus coverage

| Word | Marker | Planned scenes | Count |
|---|---|---|---:|
| 碗 | `bonus: true` in `words.json` | S01, S02, S03 | 3 |

Bonus total: **1** (maximum allowed: 10).

## Repeatable shifts

- Dishwasher hidden review: S01, S02, S03, and S24.
- Porter hidden review: S05, S07, and S23.
- Delivery hidden review: S08 and S21.
- Slot-filled counts and shaky-word substitutions vary each replay; story, errand, consequence,
  and mentor scenes are not repeatable shifts.

## Implemented reply distinctness audit

| Exchange | Replies | Distinct guarantee |
|---|---|---|
| `p1_noodle_dishwasher_01_e1` | 好 / 不 | fixed polarity |
| `p1_noodle_dishwasher_01_e2` | 杯子 / 碗 | different nouns |
| `p1_noodle_dishwasher_01_e3` | 碗 / 杯子 | different nouns |
| `p1_noodle_dishwasher_01_e4` | 好 / 杯子 | acknowledgement vs noun |
| `p1_noodle_dishwasher_01_e5` | `{cup_count}个` / `{bowl_count}个` | different slots, same `number_1_10` pool; engine re-picks collisions |
| `p1_noodle_dishwasher_01_wrong_e1` | 好 | singleton |
| `p1_noodle_dishwasher_02_e1` | 好 / 不 | fixed polarity |
| `p1_noodle_dishwasher_02_e2` | 水和茶 / 茶和水 | fixed reversed order |
| `p1_noodle_dishwasher_02_e3` | 我喝水 / 我喝茶 | different drink nouns |
| `p1_noodle_dishwasher_02_e4` | 好 / 碗 | acknowledgement vs noun |
| `p1_noodle_dishwasher_02_e5` | 六个 / 四个 | different fixed numbers |
| `p1_noodle_dishwasher_02_wrong_e1` | 好 | singleton |
| `p1_noodle_dishwasher_02_wrong_e2` | 杯子 | singleton |
| `p1_noodle_dishwasher_03_e1` | 有 / 有茶 | fixed phrase length |
| `p1_noodle_dishwasher_03_e2` | 有菜 / 有米饭 | different food nouns |
| `p1_noodle_dishwasher_03_e3` | 没有茶 / 没有水 | different drink nouns |
| `p1_noodle_dishwasher_03_e4` | 不喝茶 / 不喝水 | different drink nouns |
| `p1_noodle_dishwasher_03_e5` | 我吃米饭 / 我吃菜 | different food nouns |
| `p1_noodle_dishwasher_03_wrong_e1` | 好 | singleton |
| `p1_noodle_dishwasher_03_wrong_e2` | 不吃 | singleton |
