/**
 * A股 ETF 标的全量分类数据表
 * 涵盖：🏛️ 宽基指数 (25只) | 🛡️ 稳定行业 (27只) | 🚀 景气行业 (39只)
 * 共 91 只做 T 网格优质标的
 */

export const ETF_CATEGORIES = [
  {
    id: "broad",
    name: "🏛️ 宽基指数",
    description: "涵盖大盘、中盘、小微盘、双创与跨境T+0，流动性最好，无退市清盘风险",
    subCategories: [
      {
        name: "核心大盘",
        items: [
          { code: "510300", name: "沪深300ETF (华泰柏瑞)", tag: "规模3000亿+", note: "A股流动性之王 · 破网风险极低", featured: true },
          { code: "159919", name: "沪深300ETF (嘉实)", tag: "深市最大300", note: "大盘蓝筹基石" },
          { code: "510050", name: "上证50ETF (华夏)", tag: "超大盘蓝筹", note: "银行中字头基石 · 超强防御", featured: true },
          { code: "560510", name: "中证A500ETF (国泰)", tag: "新一代宽基", note: "均衡布局 · 资金持续流入", featured: true },
          { code: "159338", name: "中证A500ETF (景顺长城)", tag: "深市头部A500", note: "新一代核心宽基" },
          { code: "560350", name: "中证A50ETF (富国)", tag: "各行业第一", note: "行业龙头宽基" }
        ]
      },
      {
        name: "中盘均衡",
        items: [
          { code: "510500", name: "中证500ETF (南方)", tag: "规模千亿+", note: "中盘股标杆 · 均值回归特性强", featured: true },
          { code: "510510", name: "中证500ETF (广发)", tag: "中盘核心", note: "高流动性中盘宽基" },
          { code: "515800", name: "中证800ETF (汇添富)", tag: "大中盘均衡", note: "覆盖A股核心优质资产" }
        ]
      },
      {
        name: "小微高波",
        items: [
          { code: "512100", name: "中证1000ETF (南方)", tag: "规模400亿+", note: "日均振幅>2.8% · 做T高频", featured: true },
          { code: "159845", name: "中证1000ETF (华夏)", tag: "小盘成长", note: "弹性充足 · 触网频次高" },
          { code: "563300", name: "中证2000ETF (华泰柏瑞)", tag: "小微盘核心", note: "高振幅大弹性 · 适合宽网格", featured: true },
          { code: "159531", name: "中证2000ETF (南方)", tag: "微盘成长", note: "波动剧烈 · 需防极端下行" }
        ]
      },
      {
        name: "双创成长",
        items: [
          { code: "159915", name: "创业板ETF (易方达)", tag: "规模800亿+", note: "创业板定海神针 · 20%涨跌幅", featured: true },
          { code: "159949", name: "创业板50ETF (华安)", tag: "创50龙头", note: "龙头聚焦 · 弹性更高" },
          { code: "588000", name: "科创50ETF (华夏)", tag: "规模千亿+", note: "硬科技龙头 · 20%弹性高波", featured: true },
          { code: "588080", name: "科创50ETF (易方达)", tag: "科创板核心", note: "半导体软硬件集中" },
          { code: "588190", name: "科创100ETF (银华)", tag: "科创中小盘", note: "成长爆发力强 · 适合4%网格" },
          { code: "159781", name: "双创50ETF (易方达)", tag: "科创+创业50", note: "跨市场双创龙头组合" }
        ]
      },
      {
        name: "全球跨境(T+0)",
        items: [
          { code: "513130", name: "恒生科技ETF (华泰柏瑞)", tag: "★天然T+0", note: "港股互联网 · 当天买卖反复做T", featured: true },
          { code: "513180", name: "恒生科技指数ETF (华夏)", tag: "★天然T+0", note: "高流动性港股科技", featured: true },
          { code: "159920", name: "恒生ETF (华夏)", tag: "★天然T+0", note: "港股传统大盘蓝筹" },
          { code: "513100", name: "纳斯达克100ETF (国泰)", tag: "★天然T+0", note: "全球顶尖科技 · 长牛走势", featured: true },
          { code: "159941", name: "纳指ETF (广发)", tag: "★天然T+0", note: "深市纳指龙头 · 溢价稳定" },
          { code: "513500", name: "标普500ETF (博时)", tag: "★天然T+0", note: "美股500强 · 稳健做T" }
        ]
      }
    ]
  },
  {
    id: "stable",
    name: "🛡️ 稳定行业",
    description: "高股息、稳定现金流、防御属性强，适合 1.5%~3% 窄网格",
    subCategories: [
      {
        name: "煤炭",
        items: [
          { code: "515220", name: "煤炭ETF (国泰)", tag: "周期高波", note: "3.5%高振幅 · 核心推荐", featured: true }
        ]
      },
      {
        name: "公用事业",
        items: [
          { code: "159301", name: "公用事业ETF (华夏)", tag: "全指公用", note: "电力/水务/燃气", featured: true },
          { code: "560190", name: "公用事业ETF (鹏华)", tag: "全指公用", note: "防御稳健" },
          { code: "560620", name: "公用事业ETF (万家)", tag: "全指公用", note: "公用事业" },
          { code: "159159", name: "公用事业ETF (国投)", tag: "全指公用", note: "低波防御" },
          { code: "159611", name: "电力ETF", tag: "绿电火电", note: "聚焦电力板块" }
        ]
      },
      {
        name: "银行",
        items: [
          { code: "512800", name: "银行ETF (华宝)", tag: "规模第一", note: "高流动性大行", featured: true },
          { code: "515290", name: "银行ETF (天弘)", tag: "规模约42亿", note: "稳健高息" },
          { code: "516310", name: "银行ETF (易方达)", tag: "0.15%低费率", note: "低费率" },
          { code: "512700", name: "银行ETF (南方)", tag: "规模超10亿", note: "中证银行" },
          { code: "159887", name: "银行ETF (富国)", tag: "中证800银行", note: "头部银行" },
          { code: "512820", name: "银行ETF龙头 (汇添富)", tag: "行业龙头", note: "龙头聚焦" },
          { code: "512730", name: "中证银行ETF (鹏华)", tag: "中证银行", note: "中证银行" },
          { code: "516210", name: "银行ETF基金", tag: "指数基金", note: "指数跟踪" },
          { code: "515020", name: "银行ETF", tag: "大金融", note: "大金融" },
          { code: "517900", name: "银行ETF优选 (招商)", tag: "精选银行", note: "精选组合" }
        ]
      },
      {
        name: "交通运输",
        items: [
          { code: "159666", name: "交通运输ETF (华夏)", tag: "全市场唯一", note: "物流/航运/机场", featured: true },
          { code: "159731", name: "交通运输ETF", tag: "运输指数", note: "交运全覆盖" }
        ]
      },
      {
        name: "红利策略",
        items: [
          { code: "512890", name: "红利低波ETF (华泰柏瑞)", tag: "规模348亿", note: "压舱石 · 适合2%网格", featured: true },
          { code: "510880", name: "红利ETF (华泰柏瑞)", tag: "规模228亿", note: "传统高股息" },
          { code: "515450", name: "红利低波50ETF (南方)", tag: "规模200亿", note: "精选50只低波" },
          { code: "515180", name: "红利ETF (易方达)", tag: "规模193亿", note: "红利宽基" },
          { code: "563020", name: "红利低波ETF (易方达)", tag: "规模134亿", note: "红利低波" },
          { code: "515080", name: "中证红利ETF (招商)", tag: "规模122亿", note: "中证红利" },
          { code: "515100", name: "红利低波100ETF (景顺)", tag: "规模60亿", note: "红利100" },
          { code: "515300", name: "300红利低波ETF (嘉实)", tag: "规模51亿", note: "沪深300红利" },
          { code: "562060", name: "标普A股红利ETF (华宝)", tag: "标普红利", note: "标普指数" }
        ]
      }
    ]
  },
  {
    id: "prosperity",
    name: "🚀 景气行业",
    description: "高成长、大弹性、科技前沿，日均振幅大，适合 3%~5% 大波段",
    subCategories: [
      {
        name: "半导体/芯片",
        items: [
          { code: "159995", name: "芯片ETF (华夏)", tag: "规模342亿", note: "全产业链龙头", featured: true },
          { code: "512480", name: "半导体ETF (国联安)", tag: "规模245亿", note: "中证半导体" },
          { code: "588200", name: "科创芯片ETF (嘉实)", tag: "规模386亿", note: "20%科创板弹性", featured: true },
          { code: "562990", name: "半导体设备ETF (国泰)", tag: "规模128亿", note: "芯片设备自主" },
          { code: "516350", name: "芯片ETF (易方达)", tag: "规模112亿", note: "芯片产业" },
          { code: "159558", name: "半导体设备ETF (易方达)", tag: "规模76亿", note: "关键设备" },
          { code: "159516", name: "半导体材料ETF (国泰)", tag: "规模59亿", note: "芯片材料" },
          { code: "589130", name: "科创芯片ETF (易方达)", tag: "科创板", note: "科创芯片" },
          { code: "159310", name: "芯片ETF (天弘)", tag: "全产业链", note: "芯片指数" }
        ]
      },
      {
        name: "AI/算力",
        items: [
          { code: "159819", name: "人工智能ETF (易方达)", tag: "规模235亿", note: "AI全产业链龙头", featured: true },
          { code: "515070", name: "人工智能ETF (华夏)", tag: "规模87亿", note: "算力模型应用" },
          { code: "159613", name: "算力ETF (中科)", tag: "规模74亿", note: "服务器/IDC中心", featured: true },
          { code: "588730", name: "科创AI ETF (易方达)", tag: "科创板AI", note: "硬科技AI" },
          { code: "159363", name: "创业板人工智能ETF", tag: "创业板", note: "创业板AI" },
          { code: "588790", name: "科创AI ETF", tag: "科创板", note: "科创AI" },
          { code: "159140", name: "科创创业AI ETF", tag: "双创", note: "双创AI" }
        ]
      },
      {
        name: "新能源",
        items: [
          { code: "515790", name: "光伏ETF", tag: "规模124亿", note: "光伏产业龙头", featured: true },
          { code: "159755", name: "电池ETF", tag: "规模117亿", note: "锂电池产业链", featured: true },
          { code: "516160", name: "新能源ETF (南方)", tag: "规模69亿", note: "新能源综合" },
          { code: "159566", name: "储能电池ETF", tag: "规模47亿", note: "大储工商业储能" },
          { code: "515030", name: "新能源车ETF (华夏)", tag: "规模38亿", note: "智能汽车产业链" },
          { code: "159790", name: "碳中和ETF", tag: "绿色低碳", note: "碳中和主题" },
          { code: "516090", name: "新能源ETF (易方达)", tag: "中证新能源", note: "清洁能源" }
        ]
      },
      {
        name: "创新药/生物",
        items: [
          { code: "512010", name: "医药ETF (易方达)", tag: "沪深300", note: "大医药底仓", featured: true },
          { code: "516080", name: "创新药ETF (易方达)", tag: "创新药", note: "研发创新药龙头", featured: true },
          { code: "159859", name: "生物医药ETF", tag: "生物药", note: "生物科技" },
          { code: "589720", name: "科创创新药ETF", tag: "科创板", note: "前沿生物技术" },
          { code: "159508", name: "生物医药ETF (华安)", tag: "生物制药", note: "医疗生物" },
          { code: "517110", name: "创新药ETF", tag: "高景气", note: "医药吸金核心" }
        ]
      },
      {
        name: "机器人/制造",
        items: [
          { code: "159770", name: "机器人ETF", tag: "深市最大", note: "具身智能/工业机器人", featured: true },
          { code: "516800", name: "智能制造ETF", tag: "高端装备", note: "工业母机/自动化" }
        ]
      },
      {
        name: "计算机/信创",
        items: [
          { code: "562570", name: "信创ETF (华夏)", tag: "规模91亿", note: "自主可控/基础软件", featured: true },
          { code: "516630", name: "云计算50ETF (华夏)", tag: "规模48亿", note: "云服务/大数据" },
          { code: "159998", name: "计算机ETF", tag: "计算机", note: "IT软硬件全覆盖" }
        ]
      },
      {
        name: "通信/光模块",
        items: [
          { code: "515050", name: "5G通信ETF (华夏)", tag: "规模76亿", note: "5G通信/设备龙头", featured: true },
          { code: "159609", name: "光通信ETF (国泰)", tag: "规模62亿", note: "CPO/高速光模块" }
        ]
      },
      {
        name: "军工/航天",
        items: [
          { code: "159241", name: "航空航天ETF (天弘)", tag: "空天国防", note: "大飞机/空天装备", featured: true },
          { code: "512660", name: "军工ETF", tag: "国防军工", note: "国防军工全行业" }
        ]
      }
    ]
  }
];

/**
 * 扁平化获取全部标的列表
 */
export function getAllETFs() {
  const all = [];
  ETF_CATEGORIES.forEach((cat) => {
    cat.subCategories.forEach((sub) => {
      sub.items.forEach((item) => {
        all.push({
          ...item,
          category: cat.name,
          categoryId: cat.id,
          subCategory: sub.name,
        });
      });
    });
  });
  return all;
}
