import unittest
from promote_catalogue import promote


class PromotionTests(unittest.TestCase):
    def sample(self):
        return {'code': 'CS1302', 'titleEn': 'Programming', 'titleZhHans': '编程', 'titleZhHant': '編程', 'descriptionEn': 'Learn programming. Full source follows.', 'descriptionZhHans': '学习编程。', 'descriptionZhHant': '學習編程。', 'descriptionSummaryEn': 'Learn programming.', 'sourceUrl': 'https://www.cityu.edu.hk/catalogue/ug/202627/course/CS1302.htm'}

    def test_dropped_course_is_archived_and_original_code_remains(self):
        rows, count = promote([self.sample()], {'uniqueCourses': 1}, [{'code': 'CS9999', 'titleEn': 'Previous course'}])
        self.assertEqual(count, 1)
        self.assertTrue(next(r for r in rows if r['code'] == 'CS9999')['archived'])
        current = next(r for r in rows if r['code'] == 'CS1302')
        self.assertEqual(current['descriptionEn'], 'Learn programming.')
        self.assertEqual(len(current['sourceDescriptionSha256']), 64)

    def test_partial_or_untranslated_import_is_rejected(self):
        with self.assertRaises(ValueError):
            promote([self.sample()], {'uniqueCourses': 2}, [])
        row = self.sample()
        row['titleZhHans'] = ''
        with self.assertRaises(ValueError):
            promote([row], {'uniqueCourses': 1}, [])

    def test_failed_source_is_not_promoted(self):
        with self.assertRaises(ValueError):
            promote([self.sample()], {'uniqueCourses': 1, 'unresolvedDetailFailures': ['CS1302']}, [])
