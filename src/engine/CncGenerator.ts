import { CutPiece, NestedSheet } from '../types/cad';

export class CncGenerator {
  /**
   * Generates ISO standard CNC G-Code for sheet cutting and drilling
   */
  public static generateGCode(sheet: NestedSheet): string {
    const lines: string[] = [];

    lines.push('( ========================================== )');
    lines.push(`( 3D DOLAP CAD PRO - CNC G-CODE EXPORT )`);
    lines.push(`( LEVHA: #${sheet.sheetIndex} - ${sheet.material.name} )`);
    lines.push(`( EBAT: ${sheet.sheetWidth} x ${sheet.sheetHeight} x ${sheet.material.defaultThickness} mm )`);
    lines.push(`( TARIH: ${new Date().toLocaleString('tr-TR')} )`);
    lines.push('( ========================================== )');
    lines.push('G90 (Mutlak Koordinat Modu)');
    lines.push('G21 (Metrik mm Birimi)');
    lines.push('G17 (XY Calisma Duzlemi)');
    lines.push('G00 Z50.0 (Emniyet Yuksekligine Cikis)');
    lines.push('M03 S18000 (Spindle Baslat 18000 RPM)');
    lines.push('');

    sheet.pieces.forEach((piece, idx) => {
      const px = piece.x || 0;
      const py = piece.y || 0;
      const pw = piece.width;
      const ph = piece.height;

      lines.push(`( --- PARCA ${idx + 1}: ${piece.name} [${pw}x${ph}mm] --- )`);
      
      // Drilling phase (Hinge & Minifix holes if door/panel)
      if (piece.name.toLowerCase().includes('kapak')) {
        lines.push(`( Mentese Tas Delikleri - 35mm Cap, 22.5mm Kenar Payi )`);
        const hingeOffsetTop = 100;
        const hingeOffsetBottom = 100;

        // Top hinge
        lines.push(`G00 X${px + 22.5} Y${py + ph - hingeOffsetTop}`);
        lines.push(`G00 Z5.0`);
        lines.push(`G01 Z-12.5 F1200 (Mentese Havsasi Delimi)`);
        lines.push(`G00 Z10.0`);

        // Bottom hinge
        lines.push(`G00 X${px + 22.5} Y${py + hingeOffsetBottom}`);
        lines.push(`G00 Z5.0`);
        lines.push(`G01 Z-12.5 F1200`);
        lines.push(`G00 Z10.0`);
      }

      // Panel perimeter routing cut
      lines.push(`( Cevre Kesim Konturu )`);
      lines.push(`G00 X${px} Y${py}`);
      lines.push(`G00 Z2.0`);
      lines.push(`G01 Z-${piece.thickness + 0.5} F3500 (Tam Boy Kesim)`);
      lines.push(`G01 X${px + pw} Y${py} F6000`);
      lines.push(`G01 X${px + pw} Y${py + ph}`);
      lines.push(`G01 X${px} Y${py + ph}`);
      lines.push(`G01 X${px} Y${py}`);
      lines.push(`G00 Z25.0`);
      lines.push('');
    });

    lines.push('( Program Sonu )');
    lines.push('M05 (Spindle Durdur)');
    lines.push('G00 Z100.0');
    lines.push('G00 X0 Y0 (Park Pozisyonu)');
    lines.push('M30 (Program Bitti)');

    return lines.join('\n');
  }

  /**
   * Generates DXF format drawing for CNC nesting software (AutoCAD / AlphaCAM / ArtCAM / WoodWOP)
   */
  public static generateDXF(sheet: NestedSheet): string {
    const lines: string[] = [];

    // DXF Header
    lines.push('0\nSECTION\n2\nHEADER\n0\nENDSEC');
    lines.push('0\nSECTION\n2\nTABLES\n0\nENDSEC');
    lines.push('0\nSECTION\n2\nBLOCKS\n0\nENDSEC');
    lines.push('0\nSECTION\n2\nENTITIES');

    // Outer Sheet Boundary (White layer)
    this.addDXFRectangle(lines, 0, 0, sheet.sheetWidth, sheet.sheetHeight, 'SHEET_BORDER', 7);

    // Each Part Rectangle (Cyan / Blue layer)
    sheet.pieces.forEach((piece) => {
      const px = piece.x || 0;
      const py = piece.y || 0;
      this.addDXFRectangle(lines, px, py, piece.width, piece.height, 'PANEL_CUT', 4);

      // Part label text
      this.addDXFText(lines, px + piece.width / 2, py + piece.height / 2, piece.name, 'LABELS', 15);
    });

    lines.push('0\nENDSEC\n0\nEOF');
    return lines.join('\n');
  }

  private static addDXFRectangle(
    lines: string[],
    x: number,
    y: number,
    w: number,
    h: number,
    layer: string,
    color: number
  ) {
    lines.push(`0\nLWPOLYLINE\n8\n${layer}\n62\n${color}\n90\n4\n70\n1`);
    lines.push(`10\n${x}\n20\n${y}`);
    lines.push(`10\n${x + w}\n20\n${y}`);
    lines.push(`10\n${x + w}\n20\n${y + h}`);
    lines.push(`10\n${x}\n20\n${y + h}`);
  }

  private static addDXFText(
    lines: string[],
    x: number,
    y: number,
    text: string,
    layer: string,
    height: number
  ) {
    lines.push(`0\nTEXT\n8\n${layer}\n10\n${x}\n20\n${y}\n40\n${height}\n1\n${text}\n72\n1\n11\n${x}\n21\n${y}`);
  }

  /**
   * Generates CSV Cutting List for production machines & saws (Homag, Biesse, Giben, SCM)
   */
  public static generateCuttingListCSV(pieces: CutPiece[]): string {
    const headers = [
      'Parça ID',
      'Parça Adı',
      'Dolap ID',
      'Boy (mm)',
      'En (mm)',
      'Kalınlık (mm)',
      'Adet',
      'Malzeme',
      'Suyuna Kesim',
      'Üst Bant',
      'Alt Bant',
      'Sol Bant',
      'Sağ Bant',
    ];

    const rows = pieces.map((p) => [
      p.id,
      `"${p.name}"`,
      p.cabinetId || '-',
      p.height,
      p.width,
      p.thickness,
      1,
      `"${p.material.name}"`,
      p.grainDirection === 'length' ? 'Evet' : 'Farketmez',
      p.edgeBanding.top ? '0.8mm' : '-',
      p.edgeBanding.bottom ? '0.8mm' : '-',
      p.edgeBanding.left ? '0.8mm' : '-',
      p.edgeBanding.right ? '0.8mm' : '-',
    ]);

    return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  }
}
