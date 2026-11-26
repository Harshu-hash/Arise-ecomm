import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VariantMatrix from './VariantMatrix';

vi.mock('@ui/components/ImageUpload/ImageUpload', () => ({ default: () => null }));

const attrs = [
  { id: 'a1', code: 'storage', name: 'Storage', values: [{ value: '128 GB' }, { value: '256 GB' }] },
  { id: 'a2', code: 'colour', name: 'Colour', values: [{ value: 'Blue' }, { value: 'Silver' }] },
];

function Harness() {
  const [rows, setRows] = useState([]);
  return <VariantMatrix variantAttrs={attrs} value={rows} onChange={setRows} />;
}

// antd's Select opens on mouseDown and lists its options in a portal; `index` is the dropdown's position (0 storage, 1 colour)
const pick = (index, optionText) => {
  fireEvent.mouseDown(screen.getAllByRole('combobox')[index]);
  fireEvent.click(document.body.querySelector(`.ant-select-item-option[title="${optionText}"]`));
};
const chosen = (container) => [...container.querySelectorAll('.ant-select-selection-item')].map((node) => node.textContent);

describe('VariantMatrix with two options', () => {
  it('keeps the first pick while the second option is still empty, then builds the combinations', () => {
    const { container } = render(<Harness />);

    pick(0, '128 GB');
    // the bug: this pick used to vanish at once, because no variant row existed yet to remember it
    expect(chosen(container)).toEqual(['128 GB']);

    pick(1, 'Blue');
    expect(chosen(container)).toEqual(['128 GB', 'Blue']);
    expect(screen.getByText('128 GB · Blue')).toBeTruthy();

    pick(1, 'Silver');
    expect(screen.getByText('128 GB · Silver')).toBeTruthy();

    pick(0, '256 GB');
    expect(['128 GB · Blue', '128 GB · Silver', '256 GB · Blue', '256 GB · Silver'].every((label) => screen.getByText(label))).toBe(true);
  });
});
