import { fireEvent, screen } from '@testing-library/react';

/** Select through the visible Ant Design control, exercising its real change handler. */
export async function selectOption(control: HTMLElement, label: string | RegExp) {
  fireEvent.keyDown(control, { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 });
  fireEvent.click(await screen.findByText((_text, element) => {
    const text = element?.textContent ?? '';
    return typeof label === 'string' ? text === label : label.test(text);
  }, { selector: '.ant-select-item-option-content' }));
}

/** Resolve an existing native form value, then interact with the visible control. */
export async function selectFormValue(name: string | RegExp, value: string) {
  const control = screen.getByRole('combobox', { name });
  const field = control.closest('.tripri-form-select')?.querySelector('select');
  const option = Array.from(field?.options ?? []).find(option => option.value === value);
  if (!option) throw new Error(`Missing form option ${value}`);
  await selectOption(control, option.textContent ?? '');
}
