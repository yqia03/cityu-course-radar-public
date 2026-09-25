"""Focused parser contract tests; run with python3 -m unittest test_import_cityu.py."""
import unittest
from import_cityu import parse

class CourseCatalogueParserTests(unittest.TestCase):
    def test_preserves_code_suffixes_and_english_titles_with_html_entities(self):
        result=parse('''<h1 class="head d_CS">Department of Computer Science</h1>
        <a href="../../course/CS1302A.htm"><b>CS1302A</b> Computing &amp; Society</a>''')
        self.assertEqual(result.courses,[{'code':'CS1302A','titleEn':'Computing & Society','department':'Department of Computer Science','href':'../../course/CS1302A.htm'}])
    def test_nested_paragraphs_are_kept_in_official_aims_without_navigation(self):
        result=parse('''<div id="navigation">Home</div><div id="div_course_aims"><p>Learn to program.</p><ul><li>Test software.</li><li>Evaluate results.</li></ul></div><div>Copyright</div>''')
        self.assertEqual(result.fields['div_course_aims'],'Learn to program. Test software. Evaluate results.')
    def test_missing_aims_are_not_invented(self):
        result=parse('<div id="div_course_code_and_title">BME8121 - Human Machine Interface</div>')
        self.assertNotIn('div_course_aims',result.fields)
    def test_department_follows_official_heading_not_ge_secondary_group(self):
        result=parse('''<h1 class="head d_BME">Department of Biomedical Engineering</h1>
        <a href="../../course/GE1320.htm">GE1320 Engineering Your Health</a>
        <h1 class="head ge_3">Science and Technology</h1>
        <a href="../../course/GE1320.htm">GE1320 Engineering Your Health</a>''')
        self.assertEqual(result.courses[0]['department'],'Department of Biomedical Engineering')
    def test_joint_departments_preserve_official_line_breaks(self):
        result=parse('<div id="div_offering_dept">Department of Linguistics and Translation<br>School of Creative Media</div>')
        self.assertEqual(result.fieldLines['div_offering_dept'],['Department of Linguistics and Translation','School of Creative Media'])
    def test_non_course_navigation_is_excluded(self):
        result=parse('<a href="catalogue_TP.htm">Masters</a><a href="../../course/CS1302.pdf">Syllabus</a>')
        self.assertEqual(result.courses,[])

if __name__=='__main__': unittest.main()
