#!/usr/bin/env python3
"""Reproducible local CityU catalogue translation; no hosted translation credentials.

English source text is retained. Chinese is machine-generated, not official.
The persistent content-hash cache makes refreshes incremental and restartable.
Install: pip install -r requirements.txt
Model: https://argos-net.com/v1/translate-en_zh-1_9.argosmodel (unzip locally)
"""
from __future__ import annotations
import argparse, hashlib, json, re, time
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

MODEL_ID = 'argos-translate-en_zh-1_9'
PROVIDER_REVISION = 'cityu-offline-v1'
DESCRIPTION_GLOSSARY = {}

class TranslationProvider(Protocol):
    id: str
    def translate_batch(self, texts: list[str]) -> list[str]: ...

class ArgosProvider:
    id = MODEL_ID
    def __init__(self, path: Path, threads: int = 4):
        import ctranslate2
        import sentencepiece
        self.tokenizer = sentencepiece.SentencePieceProcessor(model_file=str(path / 'sentencepiece.model'))
        self.translator = ctranslate2.Translator(str(path / 'model'), device='cpu', compute_type='int8', intra_threads=threads)
    def translate_batch(self, texts: list[str]) -> list[str]:
        encoded = [self.tokenizer.encode(text, out_type=str) for text in texts]
        results = self.translator.translate_batch(encoded, beam_size=4, max_input_length=1024, max_decoding_length=512, repetition_penalty=1.1)
        return [self.tokenizer.decode(result.hypotheses[0]).replace('▁', ' ').strip() for result in results]

# Exact-title glossary corrections are editorial translations, not official titles.
# Preserve course sequence numbers independently; the MT model sometimes drops I/II.
GLOSSARY = {
 'Corporate Accounting':'公司会计', 'Calculus':'微积分', 'Calculus and Linear Algebra for Business':'商科微积分与线性代数',
 'Calculus and Basic Linear Algebra':'微积分与基础线性代数', 'Enhanced Calculus and Linear Algebra':'微积分与线性代数进阶',
 'Multi-variable Calculus and Linear Algebra':'多元微积分与线性代数', 'Multi-variable Calculus':'多元微积分',
 'Linear Algebra and Calculus':'线性代数与微积分', 'Linear Algebra':'线性代数', 'Linear Algebra with Applications':'线性代数及应用',
 'Algebra':'代数', 'Coordinate Geometry':'解析几何', 'Mathematics and Arts':'数学与艺术', 'Discrete Mathematics':'离散数学',
 'Probability and Statistics':'概率与统计', 'Probability and Stochastic Processes':'概率与随机过程',
 'Ordinary Differential Equations':'常微分方程', 'Partial Differential Equations':'偏微分方程', 'Differential Equations':'微分方程',
 'Numerical Methods for Differential Equations':'微分方程数值方法', 'Real Analysis':'实分析', 'Complex Analysis':'复分析',
 'Functional Analysis':'泛函分析', 'Numerical Analysis':'数值分析', 'Mathematical Analysis':'数学分析', 'Optimization':'优化',
 'Introduction to Computer Studies':'计算机概论', 'Introduction to Computer Programming':'计算机编程导论',
 'Introduction to Computer Science':'计算机科学导论', 'Computer Programming':'计算机编程', 'Media Computing':'媒体计算',
 'Discrete Computations':'离散计算', 'Computer Organization':'计算机组成', 'Computer Systems':'计算机系统',
 'Foundation of Cybersecurity':'网络安全基础', 'Fundamentals of Internet Applications Development':'互联网应用开发基础',
 'Data Structures for Media':'媒体数据结构', 'Data Structures for Data Science':'数据科学中的数据结构',
 'Data Structures':'数据结构', 'Data Structures and Algorithms':'数据结构与算法', 'Data Structures and Data Management':'数据结构与数据管理',
 'Problem Solving and Programming':'问题求解与编程', 'Java Programming':'Java 程序设计',
 'Operating Systems':'操作系统', 'Applied Cryptographic Systems':'应用密码系统', 'Computer Architecture':'计算机体系结构',
 'Computer Networks':'计算机网络', 'Distributed Systems':'分布式系统', 'Applied Algorithms':'应用算法',
 'Software Engineering':'软件工程', 'Machine Learning':'机器学习', 'Advanced Machine Learning':'高级机器学习',
 'Artificial Intelligence':'人工智能', 'Deep Learning':'深度学习', 'Computer Vision':'计算机视觉',
 'Natural Language Processing':'自然语言处理', 'Database Systems':'数据库系统', 'Database Management Systems':'数据库管理系统',
 'Data Mining':'数据挖掘', 'Data Science':'数据科学', 'Big Data':'大数据', 'Cloud Computing':'云计算',
 'Human-Computer Interaction':'人机交互', 'User-centred Interaction Design':'以用户为中心的交互设计',
 'IT Professionals and Society':'信息技术专业人员与社会', 'Introduction to Computational Probability Modeling':'计算概率建模导论',
 'Data Management and Cloud Storage':'数据管理与云存储', 'Data Protection and System Security':'数据保护与系统安全',
 'Professional Career Development Internship':'职业发展实习', 'Independent Research':'独立研究',
 'Chinese Cultural Heritage in Modern Perspective':'现代视角下的中国文化遗产', 'Chinese Music Appreciation':'中国音乐欣赏',
 'Chinese Art Appreciation':'中国艺术欣赏', 'Cinema: East and West':'东西方电影',
 'Exploring Hong Kong: History, Culture and Society':'探索香港：历史、文化与社会',
 'Managing Your Personal Finance':'个人理财', 'Green Economics':'绿色经济学', 'Movies and Psychology':'电影与心理学',
 'Introduction to Digital Media':'数字媒体导论', 'Creative Photography':'创意摄影', 'Music for Film':'电影配乐',
 'Social Entrepreneurship and Innovation':'社会创业与创新', 'Contemporary Accounting':'当代会计',
 'Public Health Communication':'公共卫生传播', 'Financial Accounting':'财务会计', 'Management Accounting':'管理会计',
 'Financial Management':'财务管理', 'Corporate Finance':'公司金融', 'Microeconomics':'微观经济学', 'Macroeconomics':'宏观经济学',
 'Principles of Economics':'经济学原理', 'Principles of Accounting':'会计学原理', 'Principles of Marketing':'市场营销原理',
 'Biochemistry':'生物化学', 'Molecular Biology':'分子生物学', 'Cell Biology':'细胞生物学', 'Organic Chemistry':'有机化学',
 'Inorganic Chemistry':'无机化学', 'Physical Chemistry':'物理化学', 'Analytical Chemistry':'分析化学',
 'Quantum Mechanics':'量子力学', 'Classical Mechanics':'经典力学', 'Electromagnetism':'电磁学', 'Thermodynamics':'热力学',
 'Fluid Mechanics':'流体力学', 'Engineering Mathematics and Statistics':'工程数学与统计',
}

def atomic_json(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)

def chinese_ratio(text):
    letters = re.findall(r'[A-Za-z\u3400-\u9fff]', text)
    return sum('\u3400' <= char <= '\u9fff' for char in letters) / max(len(letters), 1)

def summary_excerpt(text):
    """An extract of the first sentence, never a generated factual summary."""
    text = re.sub(r'\s+', ' ', text or '').strip()
    if not text: return ''
    pieces = re.split(r'(?<=[.!?。！？])\s+(?=[A-Z\u3400-\u9fff])', text)
    excerpt = ' '.join(pieces[:1])
    if len(excerpt) > 600:
        cut = excerpt[:600].rfind(' ')
        excerpt = excerpt[:cut if cut > 450 else 600] + '…'
    return excerpt

def split_title(title):
    match = re.search(r'\s+([IVX]{1,5})$', title)
    return (title[:match.start()], ' ' + match.group(1)) if match else (title, '')

def normalize_chinese_punctuation(text):
    text = re.sub(r'(?<=[\u3400-\u9fff])[,;:]\s*', lambda m: {',':'，',';':'；',':':'：'}[m.group(0)[0]], text)
    return re.sub(r'(?<=[\u3400-\u9fff])\.\s*(?=[\u3400-\u9fff]|$)', '。', text)


def normalize_title(source, translated):
    translated = re.sub(r'\s+', ' ', translated).strip(' .。')
    # Unambiguous mathematical term: the old OPUS model mistranslates calculus.
    if re.search(r'\bcalculus\b', source, flags=re.I):
        translated = re.sub(r'计算(?!机)', '微积分', translated)
        translated = translated.replace('演算', '微积分')
    if re.search(r'\bfoundations?\b', source, flags=re.I): translated = translated.replace('基金会', '基础')
    if re.search(r'\bputonghua\b', source, flags=re.I): translated = translated.replace('普东华', '普通话')
    if re.search(r'\binterpreting\b', source, flags=re.I): translated = translated.replace('解释', '口译')
    if re.search(r'\btransfusion\b', source, flags=re.I): translated = translated.replace('传播', '输血').replace('输液', '输血')
    if (re.search(r'\bderivatives?\b', source, flags=re.I) and '金融' in translated) or re.search(r'^Derivatives? and Risk', source, flags=re.I): translated = translated.replace('衍生物', '衍生品')
    if re.search(r'\bArtificial Intelligence\b', source, flags=re.I): translated = translated.replace('人工情报', '人工智能')
    if re.search(r'\bGenerative\b', source, flags=re.I): translated = translated.replace('基因', '生成式').replace('Generative AI', '生成式人工智能')
    if re.search(r'\bAI\b', source): translated = translated.replace('大赦国际', '人工智能')
    if re.search(r'\bGame Theory\b', source, flags=re.I): translated = translated.replace('游戏理论', '博弈论')
    if re.search(r'\bMultimodal\b', source, flags=re.I): translated = translated.replace('多式联运', '多模态')
    if re.search(r'\bCapstone\b', source, flags=re.I): translated = translated.replace('顶岩', '毕业综合').replace('封顶石', '毕业综合')
    if re.search(r'\bEquity and Trusts\b', source, flags=re.I): translated = translated.replace('公平', '衡平法')
    if re.search(r'\bFunctional Analysis\b', source, flags=re.I): translated = translated.replace('功能分析', '泛函分析')
    if re.search(r'\bDecision Analytics and Operations\b', source, flags=re.I): translated = translated.replace('决定分析和业务', '决策分析及营运')
    return normalize_chinese_punctuation(translated)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--cache', type=Path)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--threads', type=int, default=4)
    parser.add_argument('--glossary', type=Path, default=Path(__file__).resolve().parents[2] / 'data/translation/editorial-glossary.json')
    parser.add_argument('--titles-only', action='store_true')
    parser.add_argument('--description-glossary', type=Path, default=Path(__file__).resolve().parents[2] / 'data/translation/description-glossary.json')
    args = parser.parse_args()
    if args.glossary.exists(): GLOSSARY.update(json.loads(args.glossary.read_text()))
    if args.description_glossary.exists(): DESCRIPTION_GLOSSARY.update(json.loads(args.description_glossary.read_text()))
    from opencc import OpenCC
    to_hans, to_hant = OpenCC('t2s'), OpenCC('s2t')
    rows = json.loads(args.input.read_text())
    cache_path = args.cache or args.output_dir / 'translation-cache.json'
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    pending, prepared = {}, []
    def prepare(text, kind):
        if not text: return None
        if chinese_ratio(text) > 0.3: return {'source': 'official-chinese', 'text': to_hans.convert(text)}
        if kind == 'title' and text in GLOSSARY: return {'source': 'editorial-glossary', 'text': GLOSSARY[text]}
        if kind == 'description' and text in DESCRIPTION_GLOSSARY: return {'source': 'editorial-glossary', 'text': DESCRIPTION_GLOSSARY[text]}
        key = hashlib.sha256((PROVIDER_REVISION+'|'+MODEL_ID+'|'+text).encode()).hexdigest()
        if key not in cache: pending[key] = text
        return {'source': 'machine', 'key': key}
    for row in rows:
        stem, suffix = split_title(row['titleEn'])
        excerpt = '' if args.titles_only else summary_excerpt(row.get('descriptionEn'))
        prepared.append((prepare(stem, 'title'), suffix, prepare(excerpt, 'description'), excerpt, stem))
    print(f'{len(rows)} courses; {len(pending)} uncached unique texts', flush=True)
    if pending:
        provider = ArgosProvider(args.model, args.threads)
        entries = list(pending.items())
        start = time.monotonic()
        for offset in range(0, len(entries), args.batch_size):
            batch = entries[offset:offset+args.batch_size]
            translated = provider.translate_batch([entry[1] for entry in batch])
            if len(translated) != len(batch): raise RuntimeError('Provider response length mismatch')
            for (key, original), target in zip(batch, translated):
                if not target: raise RuntimeError(f'Empty translation for {original!r}')
                cache[key] = {'sourceText': original, 'translatedText': to_hans.convert(target), 'provider': provider.id}
            atomic_json(cache_path, cache)
            if offset % (args.batch_size * 8) == 0:
                print(f'{min(offset+len(batch),len(entries))}/{len(entries)} texts; {time.monotonic()-start:.1f}s', flush=True)
    def resolved(item):
        return item['text'] if 'text' in item else cache[item['key']]['translatedText']
    output, warnings = [], []
    for row, (title, suffix, description, excerpt, stem) in zip(rows, prepared):
        title_hans = normalize_title(stem, resolved(title)) + suffix
        description_hans = normalize_chinese_punctuation(resolved(description)) if description else None
        flags = []
        if not re.search(r'[\u3400-\u9fff]', title_hans): flags.append('title-no-chinese-characters')
        if len(title_hans) > max(100, len(row['titleEn'])*2): flags.append('title-unusual-length')
        if re.search(r'(.{3,12})\1\1', title_hans): flags.append('title-repetition')
        if '<unk>' in title_hans: flags.append('title-unknown-token')
        if description_hans and re.search(r'(.{5,30})\1\1', description_hans): flags.append('description-repetition')
        result = {
            **row, 'titleZhHans': title_hans, 'titleZhHant': to_hant.convert(title_hans),
            'descriptionZhHans': description_hans, 'descriptionZhHant': to_hant.convert(description_hans) if description_hans else None,
            'descriptionSummaryEn': excerpt or None,
            'translation': {'kind': 'machine-assisted', 'provider': MODEL_ID,
                'titleSource': title['source'], 'descriptionSource': description['source'] if description else 'missing',
                'reviewStatus': 'needs-human-review', 'traditionalConversion': 'OpenCC s2t', 'qualityFlags': flags},
        }
        output.append(result)
        if flags: warnings.append({'code': row['code'], 'titleEn': row['titleEn'], 'titleZhHans': title_hans, 'flags': flags})
    report = {
        'generatedAt': datetime.now(timezone.utc).isoformat(), 'input': args.input.name, 'totalCourses': len(output),
        'titlesTranslated': sum(bool(r['titleZhHans'] and r['titleZhHant']) for r in output),
        'descriptionsAvailable': sum(bool(r.get('descriptionEn')) for r in rows),
        'descriptionsTranslated': sum(bool(r['descriptionZhHans'] and r['descriptionZhHant']) for r in output),
        'titlesFromEditorialGlossary': sum(r['translation']['titleSource']=='editorial-glossary' for r in output),
        'qualityFlagCount': len(warnings), 'qualityWarnings': warnings,
        'titlesMissing': sum(not r['titleZhHans'] or not r['titleZhHant'] for r in output),
        'descriptionsMissing': sum(not r['descriptionZhHans'] or not r['descriptionZhHant'] for r in output),
        'titlesWithoutChineseCharacters': sum(not re.search(r'[\u3400-\u9fff]', r['titleZhHans']) for r in output),
        'descriptionsWithoutChineseCharacters': sum(bool(r['descriptionZhHans']) and not re.search(r'[\u3400-\u9fff]', r['descriptionZhHans']) for r in output),
        'titlesIdenticalToEnglish': sum(r['titleZhHans'] == r['titleEn'] for r in output),
        'descriptionsIdenticalToEnglish': sum(bool(r['descriptionZhHans']) and r['descriptionZhHans'] == r['descriptionSummaryEn'] and r['translation']['descriptionSource'] != 'official-chinese' for r in output),
        'provider': MODEL_ID, 'providerRevision': PROVIDER_REVISION, 'modelLicense': 'CC-BY-4.0 (according to bundled model README)',
        'translationNotice': 'Machine-assisted Chinese translations of official CityU source. Not official Chinese titles; not fully human reviewed. Descriptions translate only the first source sentence or a 600-character excerpt.',
        'sourceUrls': ['https://argos-net.com/v1/translate-en_zh-1_9.argosmodel', 'https://github.com/argosopentech/argospm-index', 'https://github.com/BYVoid/OpenCC'],
        'modelAttribution': 'Jörg Tiedemann and Santhosh Thottingal. OPUS-MT — Building open translation services for the World. EAMT 2020, Lisbon, Portugal.',
        'remainingCodesWithoutDescription': [r['code'] for r in output if not r['descriptionZhHans']],
    }
    atomic_json(args.output_dir/'courses-translated.json', output)
    atomic_json(args.output_dir/'coverage.json', report)
    atomic_json(args.output_dir/'translations.json', [{'code':r['code'], **{k:v for k,v in r.items() if k.startswith('titleZh') or k.startswith('descriptionZh') or k in ['descriptionSummaryEn', 'translation']}} for r in output])
    print(json.dumps({k:v for k,v in report.items() if k not in ['qualityWarnings','remainingCodesWithoutDescription']}, ensure_ascii=False, indent=2), flush=True)

if __name__ == '__main__': main()
