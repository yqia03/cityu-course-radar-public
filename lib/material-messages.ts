import type { Locale } from "./types";

const labels = {
  materials: ["课程资料", "課程資料", "Materials"],
  reviewsTab: ["课程与评价", "課程與評價", "Course & reviews"],
  materialsIntro: [
    "浏览目录免费；上传和下载本站文件须登录。",
    "瀏覽目錄免費；上傳和下載本站檔案須登入。",
    "Browse the catalogue freely. Sign in to upload or download hosted files.",
  ],
  reviewRewardHint: [
    "登录后首次发布有效课程评价可获 10 积分",
    "登入後首次發佈有效課程評價可獲 10 積分",
    "Sign in to earn 10 points for your first valid review of a course.",
  ],
  reviewExperience: [
    "请只评价实际修读的课程；评分高低和点赞不影响奖励。",
    "請只評價實際修讀的課程；評分高低和讚好不影響獎勵。",
    "Review only courses you have taken. Ratings and likes do not affect rewards.",
  ],
  points: ["我的积分", "我的積分", "My points"],
  balance: ["可用积分", "可用積分", "Points balance"],
  pendingReward: ["待审核奖励", "待審核獎勵", "Rewards awaiting review"],
  pendingNote: [
    "待审奖励尚未计入余额；仅验证和审核通过后发放。",
    "待審獎勵尚未計入餘額；僅驗證和審核通過後發放。",
    "Pending rewards are not part of your balance. They are awarded only after validation and approval.",
  ],
  ledger: ["积分流水", "積分流水", "Points history"],
  noLedger: [
    "暂时没有积分流水。",
    "暫時沒有積分流水。",
    "No points transactions yet.",
  ],
  pointsRules: [
    "首次登录 +3；每课首次有效登录评价 +10（每天最多 3 门）；资料验证并审核通过 +50；首次解锁每份资料 −1。本人资料、重下和已批准更新免费。",
    "首次登入 +3；每課首次有效登入評價 +10（每天最多 3 門）；資料驗證並審核通過 +50；首次解鎖每份資料 −1。本人資料、重新下載和已批准更新免費。",
    "First sign-in +3; first valid signed-in review per course +10 (up to 3 courses daily); validated and approved upload +50; first unlock −1 per material. Your own materials, repeat downloads and approved updates are free.",
  ],
  pointsLimits: [
    "积分不出售、不能提现、不可转让。旧评、匿名评价、编辑和重发不补发奖励。违规奖励可被撤回；欠分先由之后奖励抵扣。",
    "積分不出售、不能提現、不可轉讓。舊評、匿名評價、編輯和重發不補發獎勵。違規獎勵可被撤回；欠分先由之後獎勵抵扣。",
    "Points cannot be bought, cashed out or transferred. Old or anonymous reviews, edits and reposts do not earn new rewards. Invalid rewards can be reversed; future rewards repay any debt first.",
  ],
  debt: [
    "当前有欠分；余额恢复前无法解锁新资料。",
    "目前有欠分；餘額恢復前無法解鎖新資料。",
    "Your account has a points debt. Repay it before unlocking new materials.",
  ],
  date: ["日期", "日期", "Date"],
  event: ["事项", "事項", "Event"],
  amount: ["积分变动", "積分變動", "Points change"],
  reason: ["原因", "原因", "Reason"],
  all: ["全部", "全部", "All"],
  category: ["资料类型", "資料類型", "Type"],
  lecture: ["Lecture · 讲义", "Lecture · 講義", "Lecture"],
  tutorial: ["Tutorial · 习题课", "Tutorial · 習題課", "Tutorial"],
  past_exam: ["Past exam · 历年试卷", "Past exam · 歷年試卷", "Past exam"],
  notes: ["笔记／参考解答", "筆記／參考解答", "Notes / solutions"],
  academicYear: ["学年", "學年", "Academic year"],
  semester: ["学期", "學期", "Semester"],
  semesterA: ["A 学期", "A 學期", "Semester A"],
  semesterB: ["B 学期", "B 學期", "Semester B"],
  summer: ["夏季学期", "夏季學期", "Summer"],
  week: ["周次（可选）", "週次（可選）", "Week (optional)"],
  weekFilter: ["周次", "週次", "Week"],
  title: ["资料标题", "資料標題", "Material title"],
  source: ["来源及授权", "來源及授權", "Source & rights"],
  sourceUrl: ["来源链接（可选）", "來源連結（可選）", "Source link (optional)"],
  rights: ["授权说明", "授權說明", "Rights statement"],
  rightsHelp: [
    "说明作者、来源及允许站外保存和向本站用户分发的依据。仅能阅读或下载不代表可以转载。",
    "說明作者、來源及允許站外儲存和向本站用戶分發的依據。僅能閱讀或下載不代表可以轉載。",
    "Describe the author, source and permission to store and redistribute this file to site users. Permission to read or download is not permission to redistribute.",
  ],
  original: [
    "本人原创且有权分享",
    "本人原創且有權分享",
    "My own work; I can share it",
  ],
  permission: [
    "已获明确分发许可",
    "已獲明確分發許可",
    "Explicit redistribution permission",
  ],
  openLicense: [
    "允许分发的开放许可",
    "允許分發的開放許可",
    "Open licence permits redistribution",
  ],
  rightsConfirm: [
    "我确认有权在本站保存和分发此文件，且文件不含他人私人信息。",
    "我確認有權在本站儲存和分發此檔案，且檔案不含他人私人資訊。",
    "I have permission to store and distribute this file here, and it contains no other person's private information.",
  ],
  upload: ["上传资料", "上傳資料", "Upload material"],
  update: ["提交新版本", "提交新版本", "Submit an update"],
  updateNote: [
    "新版本需重新验证和审核；已批准版本保留，已解锁者免费获取更新，不再发放上传奖励。",
    "新版本需重新驗證和審核；已批准版本保留，已解鎖者免費取得更新，不再發放上傳獎勵。",
    "Updates require validation and approval. The approved version stays available; existing unlocks include updates, with no new upload reward.",
  ],
  updateMetadata: [
    "此处只更新 PDF，标题、分类及来源授权声明沿用已提交记录。",
    "此處只更新 PDF，標題、分類及來源授權聲明沿用已提交記錄。",
    "This replaces only the PDF. The title, category, source and rights statement stay as previously submitted.",
  ],
  uploadRules: [
    "仅 PDF，每份最多 50 MB；每日最多 3 份新资料，同时最多 3 份待审。提交后隔离，审核通过才上架和奖励。",
    "僅 PDF，每份最多 50 MB；每日最多 3 份新資料，同時最多 3 份待審。提交後隔離，審核通過才上架和獎勵。",
    "PDF only, up to 50 MB each. Up to 3 new uploads daily and 3 pending at once. Files are quarantined until approved; rewards follow approval.",
  ],
  unscanned: [
    "未进行自动病毒扫描。文件经人工审核也不保证无风险，请使用更新的阅读器。",
    "未進行自動病毒掃描。檔案經人工審核也不保證無風險，請使用更新的閱讀器。",
    "No automated virus scanning is connected. Manual review does not guarantee safety; use an up-to-date PDF reader.",
  ],
  file: ["选择 PDF", "選擇 PDF", "Choose PDF"],
  preparing: [
    "正在计算文件摘要…",
    "正在計算檔案摘要…",
    "Calculating file checksum…",
  ],
  uploading: [
    "正在上传，请保持此页打开…",
    "正在上傳，請保持此頁開啟…",
    "Uploading; keep this page open…",
  ],
  uploadInProgress: [
    "上传仍在服务器处理中；请稍后检查状态，不要重复预留新文件。",
    "上傳仍在伺服器處理中；請稍後檢查狀態，不要重複預留新檔案。",
    "The server is still processing this upload. Check again later instead of reserving another file.",
  ],
  uploadRecovery: [
    "此上传未完成或已被拒绝。请查看资料处理状态；未确认上传须由站长核对。",
    "此上傳未完成或已被拒絕。請查看資料處理狀態；未確認上傳須由站長核對。",
    "This upload did not complete or was rejected. Check its status; unconfirmed uploads require operator review.",
  ],
  uploadApproved: [
    "服务器确认此资料已审核上架。",
    "伺服器確認此資料已審核上架。",
    "The server confirms this material is already approved.",
  ],
  uploadReceived: [
    "服务器已接收并验证文件，现等待管理员审核；尚未发放积分。",
    "伺服器已接收並驗證檔案，現等待管理員審核；尚未發放積分。",
    "The server received and validated the file. It is awaiting moderator approval; no reward has been issued yet.",
  ],
  uploadsPaused: [
    "当前暂停接收上传，已上架资料仍可下载。",
    "目前暫停接收上傳，已上架資料仍可下載。",
    "Uploads are paused. Approved materials remain available to download.",
  ],
  unavailable: [
    "资料存储暂未开放。目录和官方查找入口仍可使用。",
    "資料儲存暫未開放。目錄和官方查找入口仍可使用。",
    "File storage is not available yet. You can still browse the catalogue and official search links.",
  ],
  empty: [
    "此筛选条件下还没有已上架资料。",
    "此篩選條件下還沒有已上架資料。",
    "No approved materials match these filters yet.",
  ],
  ownUploads: [
    "我的上传及处理状态",
    "我的上傳及處理狀態",
    "My uploads & status",
  ],
  reserved: ["等待上传", "等待上傳", "Awaiting upload"],
  pending: ["待审核", "待審核", "Awaiting review"],
  quarantined: ["隔离待审核", "隔離待審核", "Quarantined for review"],
  uploadingStatus: ["上传中", "上傳中", "Uploading"],
  approved: ["已上架", "已上架", "Approved"],
  rejected: ["审核未通过", "審核未通過", "Rejected"],
  removed: ["已下架", "已下架", "Removed"],
  failed: ["上传失败", "上傳失敗", "Upload failed"],
  abandoned: [
    "上传未确认，须站长核对",
    "上傳未確認，須站長核對",
    "Upload unconfirmed; operator review required",
  ],
  unknownStatus: ["状态待核验", "狀態待核驗", "Status requires verification"],
  expired: ["上传已过期", "上傳已過期", "Upload expired"],
  unlocked: [
    "已解锁 · 免费重下",
    "已解鎖 · 免費重下",
    "Unlocked · download free",
  ],
  ownDownload: [
    "本人资料 · 免费下载",
    "本人資料 · 免費下載",
    "Your material · download free",
  ],
  unlock: [
    "1 积分解锁并下载",
    "1 積分解鎖並下載",
    "Unlock & download · 1 point",
  ],
  unlockHint: [
    "每份资料仅首次解锁扣 1 分；重下及已批准更新免费。",
    "每份資料僅首次解鎖扣 1 分；重新下載及已批准更新免費。",
    "Only your first unlock costs 1 point. Repeat downloads and approved updates are free.",
  ],
  signIn: [
    "登录后上传／下载",
    "登入後上傳／下載",
    "Sign in to upload / download",
  ],
  report: ["举报／权利投诉", "舉報／權利投訴", "Report / rights complaint"],
  reportHelp: [
    "说明资料问题或权利依据；请勿填写密码或私人信息。也可通过网站联系页面提交删除请求。",
    "說明資料問題或權利依據；請勿填寫密碼或私人資訊。也可透過網站聯絡頁面提交刪除請求。",
    "Describe the issue or rights claim. Do not include passwords or private information. You can also request removal through the site's contact page.",
  ],
  reportSent: [
    "举报已提交，等待管理员处理。",
    "舉報已提交，等待管理員處理。",
    "Your report has been submitted for moderation.",
  ],
  officialTitle: [
    "城大图书馆历年试卷",
    "城大圖書館歷年試卷",
    "CityU Library past exam papers",
  ],
  officialAction: [
    "去图书馆查找历年试卷（免费）",
    "到圖書館查找歷年試卷（免費）",
    "Find past exam papers at the Library (free)",
  ],
  officialNote: [
    "这是通用官方查找入口，并非已匹配本课程的文件。通常仅限在校师生，须在学校页面使用 EID 及 AD/LAN 密码。本站不收集学校凭据。",
    "這是通用官方查找入口，並非已匹配本課程的檔案。通常僅限在校師生，須在學校頁面使用 EID 及 AD/LAN 密碼。本站不收集學校憑據。",
    "This is a general official search entry, not a matched paper for this course. Access is normally restricted to current students and staff using EID and AD/LAN credentials on the University's page. This site does not collect those credentials.",
  ],
  permissionPending: [
    "尚无官方试卷站外保存及分发许可，未批量导入 PDF。",
    "尚無官方試卷站外儲存及分發許可，未批量匯入 PDF。",
    "Official papers have not been bulk imported: permission for off-site storage and redistribution has not been obtained.",
  ],
  adminMaterials: [
    "资料审核与运营",
    "資料審核與營運",
    "Material moderation & operations",
  ],
  queue: ["资料与版本审核", "資料與版本審核", "Materials & version review"],
  reports: ["资料举报", "資料舉報", "Material reports"],
  audit: ["审计记录", "審計記錄", "Audit log"],
  usage: ["存储与用量", "儲存與用量", "Storage & usage"],
  storageUsed: ["已计入容量", "已計入容量", "Accounted storage"],
  storageLimit: ["容量上限", "容量上限", "Storage limit"],
  storageReserved: ["上传预留", "上傳預留", "Upload reservations"],
  usageNote: [
    "待审、预留和孤儿对象均计入容量。应用上限不是 Cloudflare 的账单上限；还须核对账户其他项目的共享额度。",
    "待審、預留和孤兒物件均計入容量。應用上限不是 Cloudflare 的帳單上限；還須核對帳戶其他專案的共享額度。",
    "Pending files, reservations and orphan objects count toward capacity. The application limit is not a Cloudflare billing cap; check shared account usage by other projects too.",
  ],
  approve: ["批准上架", "批准上架", "Approve"],
  reject: ["拒绝", "拒絕", "Reject"],
  remove: ["永久下架并退款", "永久下架並退款", "Remove & refund"],
  restore: ["恢复上架", "恢復上架", "Restore"],
  dismiss: ["关闭举报", "關閉舉報", "Dismiss report"],
  reviewFile: [
    "下载隔离文件审核",
    "下載隔離檔案審核",
    "Download quarantined file for review",
  ],
  adminReason: [
    "操作理由（必填，写入审计）",
    "操作理由（必填，寫入審計）",
    "Reason (required; recorded in audit log)",
  ],
  pause: ["停止接收上传", "停止接收上傳", "Pause uploads"],
  resume: ["恢复接收上传", "恢復接收上傳", "Resume uploads"],
  reconcile: [
    "核对对象与容量",
    "核對物件與容量",
    "Reconcile objects & capacity",
  ],
  reconcileNote: [
    "对账结果由服务器返回；清理只处理已确认过期或孤立的对象。",
    "對帳結果由伺服器返回；清理只處理已確認過期或孤立的物件。",
    "Reconciliation reports actual server results. Cleanup only handles confirmed expired or orphaned objects.",
  ],
  adjustment: [
    "有理由的积分调整",
    "有理由的積分調整",
    "Reasoned points adjustment",
  ],
  accountId: ["账户 ID", "帳戶 ID", "Account ID"],
  eventId: [
    "唯一操作编号（重试沿用）",
    "唯一操作編號（重試沿用）",
    "Unique operation ID (reuse for retries)",
  ],
  save: ["保存", "儲存", "Save"],
  saved: [
    "操作已完成并记录。",
    "操作已完成並記錄。",
    "The operation completed and was recorded.",
  ],
  cancel: ["取消", "取消", "Cancel"],
  loading: ["加载中…", "載入中…", "Loading…"],
  retry: ["重试", "重試", "Retry"],
  previous: ["上一页", "上一頁", "Previous"],
  next: ["下一页", "下一頁", "Next"],
  noItems: ["暂无记录。", "暫無記錄。", "No records yet."],
  bucketAvailable: [
    "私有对象存储已连接",
    "私有物件儲存已連接",
    "Private object storage connected",
  ],
  bucketUnavailable: [
    "未连接对象存储；不能启用上传",
    "未連接物件儲存；不能啟用上傳",
    "Object storage is not connected; uploads cannot be enabled",
  ],
  lastReconciled: [
    "上次完成对账",
    "上次完成對帳",
    "Last completed reconciliation",
  ],
  continueReconcile: [
    "继续核对下一批对象",
    "繼續核對下一批物件",
    "Reconcile next object batch",
  ],
  reconcileComplete: [
    "本批核对完成；上传保持暂停，核对账户额度后可手动恢复。",
    "本批核對完成；上傳保持暫停，核對帳戶額度後可手動恢復。",
    "This batch is reconciled. Uploads remain paused; resume them manually after checking account-wide capacity.",
  ],
  released: [
    "已清理的预留／对象",
    "已清理的預留／物件",
    "Cleaned reservations / objects",
  ],
  orphans: [
    "本批发现的孤儿对象",
    "本批發現的孤兒物件",
    "Orphan objects found in this batch",
  ],
  uncertainUploads: [
    "须人工确认的未完成上传",
    "須人工確認的未完成上傳",
    "Incomplete uploads requiring investigation",
  ],
  newAdjustment: [
    "开始另一笔调整",
    "開始另一筆調整",
    "Start another adjustment",
  ],
  adjustmentBalance: [
    "调整后账户余额",
    "調整後帳戶餘額",
    "Account balance after adjustment",
  ],
  capacityHelp: [
    "以字节填写，上限 8,000,000,000；必须根据账户共享剩余额度保留余量。",
    "以位元組填寫，上限 8,000,000,000；必須根據帳戶共享剩餘額度保留餘量。",
    "Enter bytes, up to 8,000,000,000. Leave headroom within the account's remaining shared allowance.",
  ],
  version: ["版本", "版本", "Version"],
  recoverUpload: [
    "核查并恢复过期上传",
    "核查並恢復過期上傳",
    "Check & recover expired upload",
  ],
  auditScope: [
    "显示最近 200 条审计及未处理举报。",
    "顯示最近 200 條審計及未處理舉報。",
    "Showing up to 200 recent audit events and open reports.",
  ],
  checksum: [
    "服务器验证的 SHA-256",
    "伺服器驗證的 SHA-256",
    "Server-verified SHA-256",
  ],
  notVerified: ["尚未验证", "尚未驗證", "Not yet verified"],
  action: ["操作", "操作", "Action"],
  RECONCILE_REQUIRED: [
    "请先完成对象对账并处理未完成上传，再启用上传。",
    "請先完成物件對帳並處理未完成上傳，再啟用上傳。",
    "Complete object reconciliation and resolve uncertain uploads before enabling uploads.",
  ],
  OBJECT_UNAVAILABLE: [
    "文件暂不可用；管理员须核对存储对象。已解锁记录保留，请勿重复付费。",
    "檔案暫不可用；管理員須核對儲存物件。已解鎖記錄保留，請勿重複付費。",
    "The file is unavailable; an administrator must check the storage object. Existing unlocks are retained.",
  ],
  LENGTH_REQUIRED: [
    "浏览器未提供上传长度，请重新选择文件后重试。",
    "瀏覽器未提供上傳長度，請重新選擇檔案後重試。",
    "The upload length was missing. Select the file again and retry.",
  ],
  ORIGIN: [
    "请求来源无法验证，请在本站页面重试。",
    "請求來源無法驗證，請在本站頁面重試。",
    "The request origin could not be verified. Retry from this site's page.",
  ],
  LOGIN_REQUIRED: ["请先登录。", "請先登入。", "Please sign in first."],
  FORBIDDEN: [
    "你没有进行此操作的权限。",
    "你沒有進行此操作的權限。",
    "You do not have permission for this action.",
  ],
  INVALID_INPUT: [
    "请检查必填字段、文件及授权说明。",
    "請檢查必填欄位、檔案及授權說明。",
    "Check the required fields, file and rights statement.",
  ],
  UNAVAILABLE: [
    "请求未完成，请稍后重试。不要重复提交不同的文件来重试。",
    "請求未完成，請稍後重試。不要重複提交不同的檔案來重試。",
    "The request did not complete. Please retry later; do not submit different files as retries.",
  ],
  RATE_LIMIT: [
    "请求过于频繁，请稍后重试。",
    "請求過於頻繁，請稍後重試。",
    "Too many requests. Please try again later.",
  ],
  INSUFFICIENT_POINTS: [
    "积分不足，无法解锁新资料。已解锁资料仍可免费下载。",
    "積分不足，無法解鎖新資料。已解鎖資料仍可免費下載。",
    "Insufficient points. Materials you already unlocked remain free to download.",
  ],
  STORAGE_UNAVAILABLE: [
    "文件存储尚未开放，请稍后再试。",
    "檔案儲存尚未開放，請稍後再試。",
    "File storage is not available yet. Please try later.",
  ],
  UPLOADS_PAUSED: [
    "站长已暂停新上传。",
    "站長已暫停新上傳。",
    "The operator has paused new uploads.",
  ],
  CAPACITY_EXCEEDED: [
    "存储空间已达到上限，暂停新上传。",
    "儲存空間已達到上限，暫停新上傳。",
    "The storage cap has been reached. New uploads are paused.",
  ],
  UPLOAD_LIMIT: [
    "已达每日 3 份或同时 3 份待审上限。",
    "已達每日 3 份或同時 3 份待審上限。",
    "You have reached the limit of 3 new uploads daily or 3 pending files.",
  ],
  FILE_TOO_LARGE: [
    "PDF 不能超过 50 MB。",
    "PDF 不能超過 50 MB。",
    "The PDF must be 50 MB or smaller.",
  ],
  INVALID_FILE: [
    "文件未通过 PDF 格式、大小或完整性验证。",
    "檔案未通過 PDF 格式、大小或完整性驗證。",
    "The file failed PDF format, size or integrity validation.",
  ],
  DUPLICATE_FILE: [
    "此文件已存在，不会重复存储或奖励。",
    "此檔案已存在，不會重複儲存或獎勵。",
    "This file already exists. It will not be stored or rewarded again.",
  ],
  NOT_FOUND: [
    "资料或对象不存在，或已下架。",
    "資料或物件不存在，或已下架。",
    "The material or file is missing or has been removed.",
  ],
  ACCOUNT_NOT_FOUND: [
    "找不到该积分账户，请核对账户 ID。",
    "找不到該積分帳戶，請核對帳戶 ID。",
    "This points account was not found. Check the account ID.",
  ],
  CONFLICT: [
    "状态已改变，请刷新后重试。",
    "狀態已改變，請重新載入後重試。",
    "The status has changed. Refresh and try again.",
  ],
  first_login: ["首次登录奖励", "首次登入獎勵", "First sign-in reward"],
  review_reward: ["课程评价奖励", "課程評價獎勵", "Course review reward"],
  review_reversal: ["撤回评价奖励", "撤回評價獎勵", "Review reward reversal"],
  upload_reward: ["资料审核奖励", "資料審核獎勵", "Approved upload reward"],
  upload_reversal: ["撤回资料奖励", "撤回資料獎勵", "Upload reward reversal"],
  unlock_event: ["资料首次解锁", "資料首次解鎖", "Material unlock"],
  refund: ["资料下架退款", "資料下架退款", "Material removal refund"],
  adjustment_event: ["管理员调整", "管理員調整", "Moderator adjustment"],
} as const;

export type MaterialMessageKey = keyof typeof labels;
export const materialMessage = (key: MaterialMessageKey, locale: Locale) =>
  labels[key][locale === "en" ? 2 : locale === "zh-Hant" ? 1 : 0];

export function materialError(error: unknown): MaterialMessageKey {
  const key = error instanceof Error ? error.message : "UNAVAILABLE";
  const aliases: Record<string, MaterialMessageKey> = {
    FILE_SIZE: "INVALID_FILE",
    INVALID_PDF: "INVALID_FILE",
    ACTIVE_PDF: "INVALID_FILE",
    CHECKSUM_MISMATCH: "INVALID_FILE",
    DAILY_UPLOAD_LIMIT: "UPLOAD_LIMIT",
    PENDING_UPLOAD_LIMIT: "UPLOAD_LIMIT",
    UPLOAD_DAILY_LIMIT: "UPLOAD_LIMIT",
    UPLOAD_PENDING_LIMIT: "UPLOAD_LIMIT",
    CAPACITY_LIMIT: "CAPACITY_EXCEEDED",
    STORAGE_LIMIT: "CAPACITY_EXCEEDED",
    MATERIAL_UNAVAILABLE: "NOT_FOUND",
    UPLOAD_STATE: "CONFLICT",
    R2_UNAVAILABLE: "STORAGE_UNAVAILABLE",
    UPLOADS_DISABLED: "UPLOADS_PAUSED",
    UPDATE_METADATA_MISMATCH: "updateMetadata",
    RECONCILE_BUSY: "RATE_LIMIT",
    UPLOAD_TIMEOUT: "uploadRecovery",
  };
  if (aliases[key]) return aliases[key];
  return key in labels ? (key as MaterialMessageKey) : "UNAVAILABLE";
}

export function materialStatus(status: string): MaterialMessageKey {
  if (status === "taken_down" || status === "deleted") return "removed";
  return status === "uploading"
    ? "uploadingStatus"
    : status in labels
      ? (status as MaterialMessageKey)
      : "unknownStatus";
}
