import { NumericFormat } from "react-number-format";

type Props = {
  value: number;
  onChange: (value: number) => void;
  decimalScale?: number;
  allowNegative?: boolean;
  className?: string;
  placeholder?: string;
  integerOnly?: boolean;
};

export function FormattedNumberInput({
  value,
  onChange,
  decimalScale,
  allowNegative = false,
  className,
  placeholder,
  integerOnly = false,
}: Props) {
  return (
    <NumericFormat
      value={Number.isFinite(value) ? value : 0}
      thousandSeparator
      allowNegative={allowNegative}
      decimalScale={integerOnly ? 0 : decimalScale}
      fixedDecimalScale={false}
      className={className}
      placeholder={placeholder}
      onValueChange={(values) => {
        onChange(values.floatValue ?? 0);
      }}
    />
  );
}
