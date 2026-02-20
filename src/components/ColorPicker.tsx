import { useState } from 'react';
import { COLOR_PALETTE } from '../colors';
import styles from './ColorPicker.module.css';

interface Props {
  value: string;
  onChange: (color: string) => void;
}

function isValidHex(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

export default function ColorPicker({ value, onChange }: Props) {
  const [hexInput, setHexInput] = useState(value);

  const handleHexChange = (raw: string) => {
    const s = raw.startsWith('#') ? raw : '#' + raw;
    setHexInput(raw);
    if (isValidHex(s)) onChange(s);
  };

  const handleSwatchClick = (color: string) => {
    onChange(color);
    setHexInput(color);
  };

  return (
    <div className={styles.wrap}>
      {/* Hex input row */}
      <div className={styles.hexRow}>
        <div className={styles.preview} style={{ background: isValidHex(value) ? value : '#888' }} />
        <input
          className={styles.hexInput}
          type="text"
          value={hexInput}
          maxLength={7}
          placeholder="#e05c3a"
          spellCheck={false}
          onChange={(e) => handleHexChange(e.target.value)}
          onBlur={() => setHexInput(value)}
          aria-label="Hex color code"
        />
      </div>

      {/* Palette swatches */}
      <div className={styles.palette}>
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className={`${styles.swatch} ${value === color ? styles.selected : ''}`}
            style={{ background: color }}
            onClick={() => handleSwatchClick(color)}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>
    </div>
  );
}
