import { COLOR_PALETTE } from '../colors';
import styles from './ColorPicker.module.css';

interface Props {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.palette}>
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className={`${styles.swatch} ${value === color ? styles.selected : ''}`}
            style={{ background: color }}
            onClick={() => onChange(color)}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>
      <div className={styles.customRow}>
        <label className={styles.customLabel}>
          <span>Custom</span>
          <div className={styles.customInputWrap} style={{ background: value }}>
            <input
              type="color"
              value={value}
              onChange={(e) => { onChange(e.target.value); }}
              className={styles.colorInput}
              aria-label="Custom color"
            />
          </div>
        </label>
        <span className={styles.hex}>{value}</span>
      </div>
    </div>
  );
}
