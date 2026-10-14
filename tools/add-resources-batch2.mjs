// 新增 44 条实测通过的资源（去重后），全部写入 resources.json
// 依据：candidates-verified.json 的真实 HTTP 实测结果（状态码 + 页面真实 title）
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2];
const doc = JSON.parse(await readFile(FILE, 'utf8'));
const TODAY = '2026-10-14';

const NEW_CAT = 'AI 与数据科学';

// 说明：network_requirement 只对我实测确认的填写；其余保留「未核验」，不猜。
const N = (t, d, c, u, icon, lang, tags, net) => ({
  title: t, description: d, category: c, url: u, icon, free: true,
  language_support: lang, tags,
  account_requirement: '未核验', student_requirement: '未核验',
  network_requirement: net || '未核验', hardware_requirement: '未核验',
  verification_status: '链接已实测可达（' + TODAY + '）',
  last_verified: TODAY,
  source: (/^https?:\/\/([^/]+)/.exec(u) || [])[1] || '',
  cost: '免费',
});

const ADD = [
  // ===== D1 AI 基础学习 =====
  N('动手学深度学习（PyTorch 版）', '李沐团队《动手学深度学习》第二版在线书,含可运行代码与视频,中文。', NEW_CAT, 'https://zh-v2.d2l.ai/', '📘', 'zh', ['AI', '深度学习', '在线教材', '可运行代码']),
  N('南瓜书', '《机器学习》（西瓜书）公式详细推导,Datawhale 开源,配套西瓜书使用。', NEW_CAT, 'https://github.com/datawhalechina/pumpkin-book', '🎃', 'zh', ['AI', '机器学习', '公式推导', '开源']),
  N('李宏毅机器学习 2023', '台大李宏毅机器学习课程主页,含讲义、作业与视频链接。', NEW_CAT, 'https://speech.ee.ntu.edu.tw/~hylee/ml/2023-spring.php', '🎓', 'zh+en', ['AI', '机器学习', '高校课程', '讲义']),
  N('Datawhale 开源学习社区', '国内开源学习组织,机器学习、数据分析等方向的开源教程与组队学习。', NEW_CAT, 'https://github.com/datawhalechina', '🐳', 'zh', ['AI', '开源社区', '教程', '中文']),
  N('吴恩达机器学习（B站）', '吴恩达 Machine Learning 课程中英字幕版,入门经典。', NEW_CAT, 'https://www.bilibili.com/video/BV1Pa411X76s', '📺', 'zh+en', ['AI', '机器学习', '视频课程', '入门']),
  N('蘑菇书（李宏毅深度学习笔记）', '李宏毅深度学习课程的中文笔记整理,Datawhale 开源。', NEW_CAT, 'https://github.com/datawhalechina/leedl-tutorial', '🍄', 'zh', ['AI', '深度学习', '笔记', '开源']),

  // ===== D2 AI 编程 =====
  N('DeepSeek 开放平台文档', 'DeepSeek API 官方文档,含调用方式、价格与模型说明,国内可直连。', NEW_CAT, 'https://api-docs.deepseek.com/zh-cn/', '🐋', 'zh', ['AI 编程', 'API', '国内可用', '官方文档'], '国内直连'),
  N('智谱 AI 开放平台', '智谱 GLM 系列模型 API 文档,国内手机号可注册。', NEW_CAT, 'https://open.bigmodel.cn/dev/api', '🧠', 'zh', ['AI 编程', 'API', '国内可用', '官方文档'], '国内直连'),
  N('阿里云百炼（通义）', '阿里云大模型服务平台文档,通义系列模型 API 与应用构建。', NEW_CAT, 'https://help.aliyun.com/zh/model-studio/', '☁️', 'zh', ['AI 编程', 'API', '国内可用', '官方文档'], '国内直连'),
  N('Dify 开源 LLM 应用平台', '开源的大模型应用开发平台,可自部署,支持 RAG 与 Agent 编排。', NEW_CAT, 'https://github.com/langgenius/dify', '🛠️', 'zh+en', ['AI 编程', 'RAG', 'Agent', '开源']),
  N('Model Context Protocol 文档', 'MCP 协议官方文档,统一大模型与外部工具/数据源的接口标准。', NEW_CAT, 'https://modelcontextprotocol.io/', '🔌', 'en', ['AI 编程', 'MCP', '官方文档', '英文']),
  N('LangChain 官方文档', '主流 LLM 应用开发框架文档,覆盖链式调用、检索与 Agent。', NEW_CAT, 'https://python.langchain.com/docs/', '🦜', 'en', ['AI 编程', '框架', 'Agent', '英文']),
  N('n8n 自动化', '开源工作流自动化工具,可接入大模型做自动化流程,支持自部署。', NEW_CAT, 'https://github.com/n8n-io/n8n', '🔀', 'zh+en', ['AI 编程', '自动化工具', '开源']),
  N('OpenAI 官方文档', 'OpenAI API 官方文档。注意:文档可正常阅读,但 API 调用需海外支付方式,国内可先用 DeepSeek/智谱/百炼替代。', NEW_CAT, 'https://platform.openai.com/docs', '🤖', 'en', ['AI 编程', 'API', '官方文档', '需海外支付']),

  // ===== D3 开源模型 =====
  N('ModelScope 魔搭社区', '阿里达摩院模型开源社区,模型、数据集下载与在线体验,国内直连。', NEW_CAT, 'https://www.modelscope.cn/', '🧩', 'zh', ['开源模型', '模型下载', '数据集', '国内可用'], '国内直连'),
  N('Qwen 通义千问开源', '通义千问官方开源仓库,含模型权重、技术报告与使用示例。', NEW_CAT, 'https://github.com/QwenLM/Qwen', '🌟', 'zh+en', ['开源模型', '大语言模型', '开源']),
  N('OpenBMB 面壁智能', '面壁智能开源组织,MiniCPM 等模型与工具链。', NEW_CAT, 'https://github.com/OpenBMB', '🧱', 'zh+en', ['开源模型', '大语言模型', '开源']),
  N('智源研究院 BAAI', '北京智源人工智能研究院社区,含开源模型与论文资源。', NEW_CAT, 'https://hub.baai.ac.cn/', '🏛️', 'zh', ['开源模型', '研究机构', '论文']),

  // ===== D4 本地 AI =====
  N('Ollama', '一键在本地运行大语言模型的工具,装好即可离线使用,无需联网调用。', NEW_CAT, 'https://github.com/ollama/ollama', '🦙', 'en', ['本地部署', '推理工具', '开源', '离线可用']),
  N('llama.cpp', '纯 C/C++ 实现的大模型推理引擎,可在普通电脑甚至手机运行量化模型。', NEW_CAT, 'https://github.com/ggerganov/llama.cpp', '⚙️', 'en', ['本地部署', '推理工具', '量化', '开源']),
  N('LM Studio', '桌面端大模型运行工具,图形界面管理本地模型。注:官网定位已更新为 Agent 方向。', NEW_CAT, 'https://lmstudio.ai/', '🖥️', 'en', ['本地部署', '模型管理', '图形界面']),
  N('vLLM', '高吞吐大模型推理与服务框架,适合多并发部署场景。', NEW_CAT, 'https://github.com/vllm-project/vllm', '🚀', 'en', ['本地部署', '推理工具', '开源']),

  // ===== D5 AI 科研 =====
  N('Hugging Face Daily Papers', '每日 AI 论文精选与讨论,可看社区解读。原 Papers with Code 已并入 Hugging Face。', NEW_CAT, 'https://huggingface.co/papers', '📄', 'en', ['AI 论文', '论文阅读', '英文']),
  N('和鲸社区', '国内数据科学社区,含数据集、开源项目与竞赛。', NEW_CAT, 'https://www.heywhale.com/', '🐋', 'zh', ['数据分析', '数据集', '竞赛', '国内可用'], '国内直连'),
  N('中国计算机学会 CCF', 'CCF 官方站点,含推荐国际会议与期刊目录,投稿选刊的权威参考。', NEW_CAT, 'https://www.ccf.org.cn/', '🏅', 'zh', ['学术评价', '会议期刊', '官方信息'], '国内直连'),

  // ===== D6 AI 应用 =====
  N('即梦 AI', '字节跳动旗下 AI 图像与视频生成工具,国内手机号可注册。', NEW_CAT, 'https://jimeng.jianying.com/', '🎬', 'zh', ['图像生成', '视频生成', '国内可用'], '国内直连'),
  N('通义万相', '阿里通义系列 AI 图像与视频生成模型,国内直连。', NEW_CAT, 'https://tongyi.aliyun.com/wanxiang/', '🖼️', 'zh', ['图像生成', '视频生成', '国内可用'], '国内直连'),
  N('ComfyUI', '节点式 Stable Diffusion 图形界面,流程可复用,适合进阶图像生成。', NEW_CAT, 'https://github.com/comfyanonymous/ComfyUI', '🧵', 'en', ['图像生成', '本地部署', '开源']),
  N('Stable Diffusion WebUI', '最流行的本地图像生成界面,支持文生图、图生图与插件扩展。', NEW_CAT, 'https://github.com/AUTOMATIC1111/stable-diffusion-webui', '🎨', 'en', ['图像生成', '本地部署', '开源']),

  // ===== B 编程开发缺口 =====
  N('cppreference 中文', 'C/C++ 标准库与语言特性权威参考,查语法与接口首选。', '编程开发', 'https://zh.cppreference.com/', '📕', 'zh', ['C++', 'C 语言', '官方参考', '语法速查']),
  N('Learn C++', '循序渐进的 C++ 免费教程,从基础到模板与并发。', '编程开发', 'https://www.learncpp.com/', '📗', 'en', ['C++', '教程', '免费', '英文']),
  N('计算机教育中缺失的一课（中文版）', 'MIT 课程中文版:命令行、Git、调试、性能分析等课堂上不教但必需的技能。', '编程开发', 'https://missing-semester-cn.github.io/', '🧰', 'zh', ['Linux', '命令行', 'Git', '工具链']),
  N('Pro Git 中文版', 'Git 官方推荐教材中文版,从基础到分支、服务器与内部原理。', '编程开发', 'https://git-scm.com/book/zh/v2', '🌿', 'zh', ['Git', '版本控制', '教材', '官方']),
  N('Hello 算法', '动画图解的数据结构与算法教程,支持多语言代码与一键运行。', '编程开发', 'https://github.com/krahets/hello-algo', '👋', 'zh', ['算法', '数据结构', '开源', '图解']),
  N('清华计算机课程共享计划', '清华大学计算机系课程资料汇总:课件、作业与实验。', '课程资料', 'https://github.com/PKUanonym/REKCARC-TSC-UHT', '🎒', 'zh', ['高校课程', '计算机', '课程资料', '课件']),

  // ===== C 学术科研缺口 =====
  N('Semantic Scholar', 'AI 驱动的学术搜索引擎,支持引文脉络与相关论文推荐。', '学术科研', 'https://www.semanticscholar.org/', '🔎', 'en', ['文献检索', '论文', '引文分析']),
  N('PubMed', '生物医学文献数据库,生命科学方向检索必备。', '学术科研', 'https://pubmed.ncbi.nlm.nih.gov/', '🧬', 'en', ['文献检索', '生物医学', '数据库']),
  N('Zotero 中文社区', 'Zotero 中文维护小组,提供中文插件、教程与样式下载。', '学术科研', 'https://zotero-chinese.com/', '🗂️', 'zh', ['文献管理', 'Zotero', '中文插件', '教程']),
  N('COMSOL 官方文档', 'COMSOL Multiphysics 官方文档与案例下载,多物理场仿真入门与查阅。', '学术科研', 'https://www.comsol.com/documentation', '🌡️', 'en', ['仿真软件', '多物理场', '官方文档']),
  N('MATLAB 官方文档', 'MATLAB 官方文档与示例,数值计算与数据可视化。', '学术科研', 'https://www.mathworks.com/help/matlab/', '📊', 'en', ['数值计算', '数据分析', '官方文档']),
  N('SciPy 官方文档', 'Python 科学计算基础库文档,覆盖优化、积分、信号处理等。', '学术科研', 'https://scipy.org/', '🐍', 'en', ['数据分析', '科学计算', 'Python', '官方文档']),
  N('pandas 官方文档', 'Python 数据处理库官方文档,表格数据分析核心工具。', '学术科研', 'https://pandas.pydata.org/docs/', '🐼', 'en', ['数据分析', 'Python', '官方文档']),
  N('Jupyter 官方', '交互式计算环境,数据分析与教学演示常用,支持多语言。', '学术科研', 'https://jupyter.org/', '📓', 'en', ['数据分析', '交互计算', '教学工具']),

  // ===== A 基础课程缺口 =====
  N('全国大学英语四六级考试官网', 'CET 官方报名与成绩查询入口,含考试安排与大纲。', '英语备考', 'https://cet.neea.edu.cn/', '📝', 'zh', ['英语', '四六级', '官方信息', '报名入口'], '国内直连'),
  N('可汗学院中文', '数学、物理、经济等基础学科免费课程中文版,适合补基础。', '视频课程', 'https://zh.khanacademy.org/', '🧮', 'zh', ['公开课', '数学', '基础补习', '中文']),
  N('线性代数的本质（3Blue1Brown）', '用几何直觉讲解线性代数的经典系列,理解矩阵与特征值的本质。', '视频课程', 'https://www.bilibili.com/video/BV1ys411472E', '📐', 'zh', ['数学', '线性代数', '视频课程', '直观讲解']),
];

// 去重校验：不允许与已有资源重复
const existing = new Set(doc.resources.map((r) => r.url.replace(/\/+$/, '').toLowerCase()));
const existingT = new Set(doc.resources.map((r) => r.title));
const dupUrl = ADD.filter((r) => existing.has(r.url.replace(/\/+$/, '').toLowerCase())).map((r) => r.title);
const dupTitle = ADD.filter((r) => existingT.has(r.title)).map((r) => r.title);
const selfDup = ADD.map((r) => r.title).filter((t, i, a) => a.indexOf(t) !== i);
if (dupUrl.length) { console.error('与现有资源 URL 重复: ' + dupUrl.join(', ')); process.exit(1); }
if (dupTitle.length) { console.error('与现有资源标题重复: ' + dupTitle.join(', ')); process.exit(1); }
if (selfDup.length) { console.error('新增项内部重复: ' + selfDup.join(', ')); process.exit(1); }

// 给原有 100 条补 last_verified，并标明是旧数据待复核（不冒充已实测）
let marked = 0;
for (const r of doc.resources) {
  if (r.last_verified === undefined || r.last_verified === '') {
    r.last_verified = '待复核';
    marked++;
  }
}

doc.resources.push(...ADD);
doc._count = doc.resources.length;
doc._batch2 = {
  date: TODAY,
  added: ADD.length,
  newCategory: NEW_CAT,
  note: '新增条目均经过真实 HTTP 实测（状态码 + 页面真实标题），见 candidates-verified.json。' +
    'network_requirement 仅对实测确认的标注，其余保留「未核验」。' +
    '原有 100 条标记为「待复核」，表示尚未经过同等级实测。',
};

await writeFile(FILE, JSON.stringify(doc, null, 2) + '\n', 'utf8');

const byCat = {};
for (const r of doc.resources) byCat[r.category] = (byCat[r.category] || 0) + 1;
console.log('新增条目: ' + ADD.length);
console.log('总条数  : ' + doc.resources.length + '（原 ' + (doc.resources.length - ADD.length) + ' + 新 ' + ADD.length + '）');
console.log('原有条目标记「待复核」: ' + marked + ' 条');
console.log('新增分类: ' + NEW_CAT);
console.log('\n分类分布:');
for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) console.log('  ' + c.padEnd(16) + n);
