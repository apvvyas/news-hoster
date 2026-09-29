// Fictional example content for the in-browser demo. Sources use example.com
// domains; none of this is real reporting.
import type { ArticleStatus, Language, VersionContent } from '@news-hoster/sdk'

export interface SeedStory {
  key: string
  feed: 'wire' | 'samachar' | 'tech'
  sourceLanguage: Language
  title: string
  content: string
  category: string
  tags: string[]
  hue: number
  hoursAgo: number
  status?: ArticleStatus
  versions: Record<Language, VersionContent>
}

const v = (
  headline: string,
  summary: string,
  keyPoints: string[],
  seo: { title?: string; description?: string; keyword?: string } = {},
  body = '',
): VersionContent => ({
  headline,
  summary,
  keyPoints,
  body,
  seoTitle: seo.title ?? '',
  metaDescription: seo.description ?? '',
  focusKeyword: seo.keyword ?? '',
})

export const FEEDS = [
  { key: 'wire', name: 'Demo Wire', url: 'https://example.com/feeds/national.xml', language: 'en', category: 'india', interval: 15 },
  { key: 'samachar', name: 'Sample Samachar (हिंदी)', url: 'https://example.org/rss/hindi.xml', language: 'hi', category: 'india', interval: 20 },
  { key: 'tech', name: 'Example Tech Daily', url: 'https://example.net/tech/rss', language: 'auto', category: 'technology', interval: 30 },
] as const

export const CATEGORIES: [string, string, string][] = [
  ['india', 'India', 'भारत'],
  ['world', 'World', 'विश्व'],
  ['politics', 'Politics', 'राजनीति'],
  ['business', 'Business', 'व्यापार'],
  ['technology', 'Technology', 'तकनीक'],
  ['science', 'Science', 'विज्ञान'],
  ['health', 'Health', 'स्वास्थ्य'],
  ['sports', 'Sports', 'खेल'],
  ['entertainment', 'Entertainment', 'मनोरंजन'],
  ['other', 'Other', 'अन्य'],
]

/** Already restructured when the demo opens. */
export const ARTICLES: SeedStory[] = [
  {
    key: 'rain',
    feed: 'samachar',
    sourceLanguage: 'hi',
    title: 'दिल्ली में भारी बारिश से यातायात धीमा, अगले दो दिन और बारिश के आसार',
    content:
      'राजधानी में सोमवार सुबह से लगातार बारिश हुई। कई प्रमुख सड़कों पर जलभराव के कारण यातायात धीमा रहा और दफ्तर जाने वालों को देरी हुई। मौसम विभाग ने अगले दो दिनों के लिए येलो अलर्ट जारी किया है। नगर निगम ने कहा कि जल निकासी के लिए अतिरिक्त पंप लगाए गए हैं।',
    category: 'india',
    tags: ['monsoon', 'delhi', 'traffic'],
    hue: 205,
    hoursAgo: 3,
    status: 'published',
    versions: {
      hi: v(
        'दिल्ली में भारी बारिश से यातायात धीमा, दो दिन और बारिश के आसार',
        'राजधानी में सोमवार सुबह से हो रही लगातार बारिश के कारण कई सड़कों पर जलभराव हुआ और यातायात धीमा रहा। मौसम विभाग ने अगले दो दिनों के लिए येलो अलर्ट जारी किया है।',
        [
          'कई प्रमुख सड़कों पर जलभराव से दफ्तर जाने वालों को देरी',
          'मौसम विभाग का अगले दो दिन के लिए येलो अलर्ट',
          'नगर निगम ने जल निकासी के लिए अतिरिक्त पंप लगाए',
        ],
        {
          title: 'दिल्ली बारिश: जलभराव से यातायात धीमा, येलो अलर्ट जारी',
          description: 'दिल्ली में सोमवार को भारी बारिश से कई सड़कों पर जलभराव हुआ। मौसम विभाग ने अगले दो दिन के लिए येलो अलर्ट जारी किया है।',
          keyword: 'दिल्ली बारिश',
        },
      ),
      en: v(
        'Heavy rain slows Delhi traffic, more showers expected for two days',
        'Continuous rain since Monday morning flooded several roads in the capital and slowed traffic. The weather department has issued a yellow alert for the next two days.',
        [
          'Waterlogging on major roads delayed office commuters',
          'Yellow alert issued for the next two days',
          'Civic body has deployed extra pumps for drainage',
        ],
        {
          title: 'Delhi rain: waterlogging slows traffic, yellow alert issued',
          description: 'Heavy rain on Monday left several Delhi roads waterlogged and slowed traffic. A yellow alert is in place for the next two days.',
          keyword: 'Delhi rain',
        },
      ),
    },
  },
  {
    key: 'metro',
    feed: 'wire',
    sourceLanguage: 'en',
    title: "City metro's new corridor begins trial runs ahead of opening",
    content:
      'The new 12-km corridor of the city metro started trial runs on Tuesday. Officials said safety certification is expected within six weeks. The line has nine stations and is expected to carry about 1.5 lakh passengers a day once it opens. Trains will initially run every eight minutes.',
    category: 'india',
    tags: ['metro', 'transport'],
    hue: 150,
    hoursAgo: 7,
    status: 'published',
    versions: {
      en: v(
        "City metro's new 12-km corridor begins trial runs",
        'Trial runs began on Tuesday on the metro’s new 12-km, nine-station corridor. Officials expect safety certification within six weeks, after which the line should carry about 1.5 lakh passengers a day.',
        ['12-km corridor with nine stations', 'Safety certification expected within six weeks', 'Trains to run every eight minutes at first'],
        {
          title: 'New metro corridor begins trial runs, opening in weeks',
          description:
            'The metro’s new 12-km corridor started trial runs on Tuesday. Safety certification is expected within six weeks; about 1.5 lakh daily riders are projected.',
          keyword: 'metro corridor',
        },
      ),
      hi: v(
        'मेट्रो के नए 12 किमी कॉरिडोर पर ट्रायल रन शुरू',
        'मेट्रो के नौ स्टेशनों वाले नए 12 किलोमीटर लंबे कॉरिडोर पर मंगलवार से ट्रायल रन शुरू हो गया। अधिकारियों के अनुसार छह हफ्तों में सुरक्षा प्रमाणन मिलने की उम्मीद है।',
        ['नौ स्टेशनों वाला 12 किमी लंबा कॉरिडोर', 'छह हफ्तों में सुरक्षा प्रमाणन की उम्मीद', 'शुरुआत में हर आठ मिनट पर चलेंगी ट्रेनें'],
        {
          title: 'मेट्रो कॉरिडोर पर ट्रायल रन शुरू, जल्द खुलेगी लाइन',
          description: 'मेट्रो के नए 12 किमी कॉरिडोर पर मंगलवार से ट्रायल रन शुरू हुआ। रोज़ाना करीब 1.5 लाख यात्रियों के सफर का अनुमान है।',
          keyword: 'मेट्रो कॉरिडोर',
        },
      ),
    },
  },
  {
    key: 'heat',
    feed: 'tech',
    sourceLanguage: 'en',
    title: 'Researchers map urban heat islands in five cities using satellite data',
    content:
      'A university team used ten years of satellite readings to map heat islands in five Indian cities. Dense built-up areas were up to 6°C hotter than nearby green zones at night. The researchers recommend cool roofs and more tree cover in the hottest wards.',
    category: 'science',
    tags: ['climate', 'cities', 'heat'],
    hue: 20,
    hoursAgo: 11,
    status: 'published',
    versions: {
      en: v(
        'Satellite study maps heat islands in five Indian cities',
        'A university team analysed ten years of satellite data and found dense built-up areas up to 6°C hotter at night than nearby green zones. They recommend cool roofs and more trees in the hottest wards.',
        ['Ten years of satellite readings analysed', 'Built-up areas up to 6°C hotter at night', 'Cool roofs and tree cover recommended'],
        {
          title: 'Urban heat islands: dense areas up to 6°C hotter at night',
          description:
            'A satellite study of five Indian cities finds built-up areas up to 6°C hotter at night than green zones, and recommends cool roofs and trees.',
          keyword: 'heat islands',
        },
      ),
      hi: v(
        'सैटेलाइट अध्ययन: पांच शहरों में ‘हीट आइलैंड’ का नक्शा तैयार',
        'एक विश्वविद्यालय की टीम ने दस साल के सैटेलाइट डेटा से पाया कि घनी आबादी वाले इलाके रात में हरित क्षेत्रों से 6°C तक अधिक गर्म रहते हैं। शोधकर्ताओं ने कूल रूफ और अधिक पेड़ लगाने की सलाह दी है।',
        ['दस साल के सैटेलाइट आंकड़ों का विश्लेषण', 'घने इलाके रात में 6°C तक अधिक गर्म', 'कूल रूफ और हरियाली बढ़ाने की सिफारिश'],
        { title: 'शहरों के हीट आइलैंड: रात में 6°C तक ज्यादा गर्मी', description: '', keyword: 'हीट आइलैंड' },
      ),
    },
  },
  {
    key: 'upi',
    feed: 'wire',
    sourceLanguage: 'en',
    title: 'Small businesses turn to UPI-linked credit lines',
    content:
      'More small shop owners are using credit lines linked to UPI to manage stock purchases, according to a lenders’ association report. The report says average ticket sizes remain small, under ₹20,000. It also flags the need for clear disclosure of fees.',
    category: 'business',
    tags: ['upi', 'credit', 'msme'],
    hue: 265,
    hoursAgo: 14,
    status: 'draft',
    versions: {
      en: v(
        'Small shops increasingly use UPI-linked credit lines',
        'A lenders’ association report says more small shop owners are using UPI-linked credit lines to buy stock, with average loans under ₹20,000. It calls for clearer disclosure of fees.',
        ['Average credit line below ₹20,000', 'Used mainly for stock purchases', 'Report asks for clearer fee disclosure'],
        { title: 'UPI credit lines gain ground among small shops', description: '', keyword: 'UPI credit' },
      ),
      hi: v(
        'छोटे दुकानदारों में यूपीआई से जुड़ी क्रेडिट लाइन का चलन बढ़ा',
        'ऋणदाताओं के एक संगठन की रिपोर्ट के अनुसार अधिक छोटे दुकानदार माल खरीदने के लिए यूपीआई से जुड़ी क्रेडिट लाइन का इस्तेमाल कर रहे हैं। औसत कर्ज़ ₹20,000 से कम है।',
        ['औसत क्रेडिट लाइन ₹20,000 से कम', 'मुख्य रूप से माल की खरीद के लिए इस्तेमाल', 'शुल्क की स्पष्ट जानकारी देने की मांग'],
        { keyword: 'यूपीआई क्रेडिट' },
      ),
    },
  },
  {
    key: 'u19',
    feed: 'wire',
    sourceLanguage: 'en',
    title: 'Under-19 team seals series with six-wicket win',
    content:
      'The under-19 side won the third one-day match by six wickets to take the series 2-1. Chasing 231, the team reached the target with 19 balls to spare. The opening pair added 98 runs.',
    category: 'sports',
    tags: ['cricket', 'under-19'],
    hue: 95,
    hoursAgo: 20,
    status: 'draft',
    versions: {
      en: v(
        'Under-19 side wins by six wickets to clinch series 2-1',
        'The under-19 team chased down 231 with 19 balls to spare in the third one-dayer, sealing the series 2-1. A 98-run opening stand set up the win.',
        ['Target of 231 reached with 19 balls left', 'Opening pair added 98 runs', 'Series won 2-1'],
        {
          title: 'Under-19 team clinches series 2-1 with six-wicket win',
          description: 'The under-19 side chased 231 with 19 balls to spare to win the third one-dayer by six wickets and take the series 2-1.',
          keyword: 'under-19 series',
        },
      ),
      hi: v(
        'अंडर-19 टीम ने छह विकेट से जीतकर सीरीज़ 2-1 से अपने नाम की',
        'अंडर-19 टीम ने तीसरे वनडे में 231 रन का लक्ष्य 19 गेंद शेष रहते हासिल कर सीरीज़ 2-1 से जीत ली। सलामी जोड़ी ने 98 रन जोड़े।',
        ['231 रन का लक्ष्य 19 गेंद शेष रहते हासिल', 'सलामी जोड़ी की 98 रन की साझेदारी', 'सीरीज़ 2-1 से जीती'],
        {
          title: 'अंडर-19 टीम ने छह विकेट से जीती सीरीज़',
          description: 'तीसरे वनडे में 231 रन का लक्ष्य हासिल कर अंडर-19 टीम ने सीरीज़ 2-1 से जीती।',
          keyword: 'अंडर-19',
        },
      ),
    },
  },
  {
    key: 'opd',
    feed: 'samachar',
    sourceLanguage: 'hi',
    title: 'प्रतीक्षा समय घटाने के लिए सरकारी अस्पतालों में शाम की ओपीडी',
    content:
      'राज्य के छह बड़े सरकारी अस्पतालों में अगले महीने से शाम 5 से 8 बजे तक ओपीडी चलेगी। स्वास्थ्य विभाग का कहना है कि इससे सुबह की भीड़ कम होगी। शाम की ओपीडी में सामान्य चिकित्सा और बाल रोग विभाग शामिल होंगे।',
    category: 'health',
    tags: ['hospitals', 'opd'],
    hue: 340,
    hoursAgo: 26,
    status: 'draft',
    versions: {
      hi: v(
        'सरकारी अस्पतालों में शाम की ओपीडी शुरू होगी',
        'राज्य के छह बड़े सरकारी अस्पतालों में अगले महीने से शाम 5 से 8 बजे तक ओपीडी चलेगी, ताकि सुबह की भीड़ और प्रतीक्षा समय कम हो।',
        ['छह बड़े अस्पतालों में शाम 5 से 8 बजे तक ओपीडी', 'सामान्य चिकित्सा और बाल रोग विभाग शामिल'],
      ),
      en: v(
        'Government hospitals to add evening OPD hours',
        'Six large state-run hospitals will run OPDs from 5 pm to 8 pm starting next month to ease morning crowds and cut waiting times.',
        ['Evening OPD from 5 pm to 8 pm at six hospitals', 'General medicine and paediatrics included'],
      ),
    },
  },
  {
    key: 'speech',
    feed: 'tech',
    sourceLanguage: 'en',
    title: 'Startup releases open-source Hindi speech-to-text model',
    content:
      'A Bengaluru startup released an open-source speech-to-text model for Hindi under a permissive licence. The company says it runs on a single consumer GPU.',
    category: 'technology',
    tags: ['ai', 'speech', 'open source'],
    hue: 230,
    hoursAgo: 40,
    status: 'trash',
    versions: {
      en: v(
        'Startup open-sources a Hindi speech-to-text model',
        'A Bengaluru startup has released an open-source Hindi speech-to-text model under a permissive licence, saying it runs on a single consumer GPU.',
        [],
      ),
      hi: v(
        'स्टार्टअप ने हिंदी स्पीच-टू-टेक्स्ट मॉडल ओपन-सोर्स किया',
        'बेंगलुरु के एक स्टार्टअप ने हिंदी के लिए ओपन-सोर्स स्पीच-टू-टेक्स्ट मॉडल जारी किया है।',
        [],
      ),
    },
  },
]

/** Stories that are still in the queue (or arrive when you press "Run now"). */
export const QUEUE: (SeedStory & { arrives?: 'first-run' })[] = [
  {
    key: 'bus',
    feed: 'wire',
    sourceLanguage: 'en',
    title: 'State announces free bus travel for students during board exams',
    content:
      'Students appearing for board exams will be able to travel free on state transport buses on exam days, the transport department said. Students need to show their admit card to the conductor. The scheme covers both city and inter-city buses.',
    category: 'india',
    tags: ['education', 'transport'],
    hue: 45,
    hoursAgo: 1,
    versions: {
      en: v(
        'Free bus rides for students on board exam days',
        'Students taking board exams can travel free on state transport buses on exam days by showing their admit card, the transport department said. City and inter-city buses are covered.',
        ['Free travel on exam days only', 'Admit card must be shown to the conductor', 'Covers city and inter-city buses'],
        {
          title: 'Board exams: free state bus travel for students on exam days',
          description: 'Students with a board exam admit card can ride state transport buses free on exam days, including inter-city routes.',
          keyword: 'free bus travel',
        },
      ),
      hi: v(
        'बोर्ड परीक्षा के दिन छात्रों को बसों में मुफ्त यात्रा',
        'परिवहन विभाग के अनुसार बोर्ड परीक्षा देने वाले छात्र परीक्षा के दिन एडमिट कार्ड दिखाकर राज्य परिवहन की बसों में मुफ्त यात्रा कर सकेंगे। शहरी और अंतर-शहरी दोनों बसें शामिल हैं।',
        ['केवल परीक्षा के दिन मुफ्त यात्रा', 'कंडक्टर को एडमिट कार्ड दिखाना होगा', 'शहरी और अंतर-शहरी बसें शामिल'],
        {
          title: 'बोर्ड परीक्षा: छात्रों को परीक्षा के दिन बसों में मुफ्त सफर',
          description: 'एडमिट कार्ड दिखाकर बोर्ड परीक्षा के छात्र परीक्षा के दिन राज्य परिवहन की बसों में मुफ्त यात्रा कर सकेंगे।',
          keyword: 'मुफ्त बस यात्रा',
        },
      ),
    },
  },
  {
    key: 'crop',
    feed: 'samachar',
    sourceLanguage: 'hi',
    title: 'किसानों के लिए मौसम आधारित फसल सलाह का नया ऐप',
    content:
      'कृषि विभाग ने किसानों के लिए एक ऐप शुरू किया है जो ब्लॉक स्तर पर पांच दिन का मौसम पूर्वानुमान और फसल सलाह देगा। ऐप हिंदी और अंग्रेज़ी में उपलब्ध है। पहले चरण में 40 ज़िलों को शामिल किया गया है।',
    category: 'india',
    tags: ['agriculture', 'weather', 'app'],
    hue: 110,
    hoursAgo: 2,
    arrives: 'first-run',
    versions: {
      hi: v(
        'किसानों को ब्लॉक स्तर पर मौसम और फसल सलाह देगा नया ऐप',
        'कृषि विभाग का नया ऐप ब्लॉक स्तर पर पांच दिन का मौसम पूर्वानुमान और फसल सलाह देगा। पहले चरण में 40 ज़िले शामिल हैं।',
        ['ब्लॉक स्तर पर पांच दिन का पूर्वानुमान', 'हिंदी और अंग्रेज़ी में उपलब्ध', 'पहले चरण में 40 ज़िले'],
        {
          title: 'किसानों के लिए मौसम आधारित फसल सलाह ऐप लॉन्च',
          description: 'कृषि विभाग का नया ऐप 40 ज़िलों के किसानों को ब्लॉक स्तर पर पांच दिन का मौसम पूर्वानुमान और फसल सलाह देगा।',
          keyword: 'फसल सलाह ऐप',
        },
      ),
      en: v(
        'New app gives farmers block-level weather and crop advice',
        'The agriculture department’s new app offers five-day, block-level weather forecasts with crop advisories. The first phase covers 40 districts.',
        ['Five-day block-level forecasts', 'Available in Hindi and English', '40 districts in the first phase'],
        {
          title: 'Farmers get block-level weather and crop advice app',
          description: 'A new agriculture department app gives farmers in 40 districts five-day block-level forecasts and crop advisories.',
          keyword: 'crop advisory app',
        },
      ),
    },
  },
  {
    key: 'chips',
    feed: 'tech',
    sourceLanguage: 'en',
    title: 'Chip design course to be offered at 30 technical institutes',
    content:
      'A semester-long chip design course will be offered at 30 technical institutes from the next academic year. Students will get access to industry design tools through a shared cloud lab. The course includes a tape-out project for top teams.',
    category: 'technology',
    tags: ['semiconductors', 'education'],
    hue: 185,
    hoursAgo: 2,
    arrives: 'first-run',
    versions: {
      en: v(
        'Chip design course coming to 30 technical institutes',
        'From the next academic year, 30 technical institutes will offer a semester-long chip design course with cloud access to industry design tools and a tape-out project for top teams.',
        ['Semester-long course at 30 institutes', 'Shared cloud lab with industry tools', 'Tape-out project for top teams'],
        { title: 'Chip design course launches at 30 technical institutes', description: '', keyword: 'chip design course' },
      ),
      hi: v(
        '30 तकनीकी संस्थानों में शुरू होगा चिप डिज़ाइन कोर्स',
        'अगले शैक्षणिक सत्र से 30 तकनीकी संस्थानों में एक सेमेस्टर का चिप डिज़ाइन कोर्स शुरू होगा, जिसमें क्लाउड लैब के ज़रिए इंडस्ट्री टूल्स उपलब्ध होंगे।',
        ['30 संस्थानों में एक सेमेस्टर का कोर्स', 'क्लाउड लैब में इंडस्ट्री टूल्स', 'शीर्ष टीमों के लिए टेप-आउट प्रोजेक्ट'],
        { keyword: 'चिप डिज़ाइन' },
      ),
    },
  },
]

/** An inline SVG "photo" per story (external images are not available in the demo). */
export function coverImage(hue: number, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},55%,42%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},60%,28%)"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><circle cx="520" cy="90" r="120" fill="hsl(${hue},70%,70%)" opacity=".18"/><circle cx="90" cy="320" r="160" fill="hsl(${hue},70%,80%)" opacity=".12"/><text x="32" y="324" font-family="sans-serif" font-size="28" font-weight="700" fill="#fff" opacity=".9">${label}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
