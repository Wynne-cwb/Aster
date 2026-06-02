/**
 * src/lib/parsers/pptx.test.ts — FILE-05 pptx 解析器测试（Wave 0 红灯 stub）
 *
 * Wave 0：测试先于实现。import './pptx' 路径在 Wave 2 之前不存在，
 * 运行时报 "Cannot find module './pptx"（红灯）。
 *
 * jszip mock：模拟含 slide1.xml / slide2.xml / slide10.xml + notesSlide1.xml 的 pptx 文件结构。
 */
import { describe, it, expect, vi } from 'vitest';

// 各 slide XML 内容（含 <a:t> 标签模拟 OOXML 文本节点）
const slide1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>第一页标题</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`;

const slide2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>第二页内容</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`;

const slide10Xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>第十页内容</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`;

const notesSlide1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>演讲者备注内容</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:notes>`;

// Mock jszip：模拟含 3 个 slide + 1 个 notesSlide 的 pptx 结构
vi.mock('jszip', () => {
  const mockFiles = {
    'ppt/slides/slide1.xml': { async: vi.fn().mockResolvedValue(slide1Xml) },
    'ppt/slides/slide2.xml': { async: vi.fn().mockResolvedValue(slide2Xml) },
    'ppt/slides/slide10.xml': { async: vi.fn().mockResolvedValue(slide10Xml) },
    'ppt/notesSlides/notesSlide1.xml': { async: vi.fn().mockResolvedValue(notesSlide1Xml) },
  };
  return {
    default: class MockJSZip {
      async loadAsync(_data: unknown) {
        return { files: mockFiles };
      }
    },
  };
});

import { parsePptx } from './pptx';

describe('parsePptx — FILE-05 pptx 解析（Wave 0 红灯）', () => {
  it('Test 1: parsePptx(file) slide 按数字序排序（slide1 < slide2 < slide10，非字符串排序）', async () => {
    const fakeFile = new File(['fake pptx bytes'], 'test.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    const result = await parsePptx(fakeFile);

    // 验证数字排序：slide1 < slide2 < slide10
    // 字符串排序会导致 slide1 < slide10 < slide2（错误）
    const idx1 = result.indexOf('第一页标题');
    const idx2 = result.indexOf('第二页内容');
    const idx10 = result.indexOf('第十页内容');
    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeGreaterThan(idx1);
    expect(idx10).toBeGreaterThan(idx2);
  });

  it('Test 2: <a:t> 文本被正确提取（DOMParser 解析 OOXML 文本节点）', async () => {
    const fakeFile = new File(['fake pptx bytes'], 'text.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    const result = await parsePptx(fakeFile);

    // <a:t> 内的文本应出现在输出中
    expect(result).toContain('第一页标题');
    expect(result).toContain('第二页内容');
    expect(result).toContain('第十页内容');
  });

  it('Test 3: 演讲者备注（notesSlide1.xml）被提取，前缀 "[Slide N 备注]"', async () => {
    const fakeFile = new File(['fake pptx bytes'], 'notes.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    const result = await parsePptx(fakeFile);

    // 演讲者备注内容应出现在输出中
    expect(result).toContain('演讲者备注内容');
    // 备注前缀标记（验证格式化输出）
    expect(result).toMatch(/\[Slide\s+\d+\s*备注\]/);
  });
});
