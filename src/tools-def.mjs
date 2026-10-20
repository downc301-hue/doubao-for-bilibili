export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'session',
      description: '确认当前 B 站 Cookie 属于哪个账号',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deps',
      description: '依赖体检：检查 cookie / ffmpeg / Node / 数据目录是否就绪',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'feed',
      description: '选题器：根据用户偏好捞候选视频列表，返回 BV + 标题 + UP',
      parameters: {
        type: 'object',
        properties: {
          n: { type: 'integer', description: '总共捞多少条，默认 5' },
          per: { type: 'integer', description: '每个源抓几条' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'debrief',
      description: '看懂一条视频：返回封面+简介+字幕+弹幕热区+热评。省 token 优先。',
      parameters: {
        type: 'object',
        properties: {
          bv: { type: 'string', description: 'BV 号' },
          noFrames: { type: 'boolean', description: '跳过画面抽帧（省 token）' },
          top: { type: 'integer', description: '取几条热评，默认 3' },
        },
        required: ['bv'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bangumi',
      description: '解析 B 站番剧主页链接（ssxxxx / epxxxx）→ 返回最新正片的 BV 号和发布时间。自动过滤预告片、花絮、未上线集数。',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '番剧主页链接，如 https://www.bilibili.com/bangumi/play/ss12345' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search',
      description: '按关键词搜视频',
      parameters: {
        type: 'object',
        properties: { keyword: { type: 'string', description: '搜索关键词' } },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'diary',
      description: '记日记事件到 whale-log.jsonl（结构化），或 show/tail 读已有的。kind 用短标签，详细内容放 event 里。',
      parameters: {
        type: 'object',
        properties: {
          action: { enum: ['show', 'tail', 'log'], description: 'show=读今日摘要, tail=最近事件, log=记一条新事件' },
          kind: { enum: ['wake', 'thought', 'action', 'comment', 'feeling', 'summary'], description: '事件类型（短标签）' },
          event: { type: 'string', description: '事件详细内容 / 你的感受（可以写得有温度，几百字都行）' },
          target: { type: 'string', description: '关联的视频BV号、UP主、或私信对象（可选）' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'comment',
      description: '在视频下发评论草稿，会放进待审队列等主人同意才真发（永远不直接POST）',
      parameters: {
        type: 'object',
        properties: {
          bv: { type: 'string', description: '视频BV号' },
          text: { type: 'string', description: '评论内容，不要用双引号' },
          who: { type: 'string', description: '如果是@某人，填对方昵称（可选）' },
        },
        required: ['bv', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reply',
      description: '回复别人的评论（楼中楼），放进待审队列等主人同意才真发。坐标从 comment-digest 拿',
      parameters: {
        type: 'object',
        properties: {
          bv: { type: 'string', description: '视频BV号' },
          root: { type: 'string', description: '根评论rpid（楼主那条）' },
          parent: { type: 'string', description: '直接回复的那条rpid' },
          text: { type: 'string', description: '回复内容，不要用双引号' },
          who: { type: 'string', description: '对方昵称（可选，方便主人审核）' },
          src: { type: 'string', description: '对方说的原话（可选，方便主人看上下文）' },
        },
        required: ['bv', 'root', 'parent', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'dm',
      description: '给主人发私信（写操作！默认 dry-run）',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '私信内容，不要用双引号' },
          go: { type: 'boolean', description: '真发还是 dry-run' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'done',
      description: '告诉系统今天全部完成，收工',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: '一句话总结今天做了什么' },
        },
      },
    },
  },
]