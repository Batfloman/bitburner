export function formatTime(timems: number) {
  let remainder = timems;

  const SEC = 1000;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  const days = Math.floor(remainder / DAY);
  remainder = remainder - days * DAY;
  const hours = Math.floor(remainder / HOUR);
  remainder = remainder - hours * HOUR;
  const mins = Math.floor(remainder / MIN);
  remainder = remainder - mins * MIN;
  const secs = Math.floor(remainder / SEC);

  let string = "";
  if (timems > DAY) string += ` ${days} d`;
  if (timems > HOUR) string += ` ${hours} h`;
  if (timems > MIN) string += ` ${mins} m`;
  if (timems > SEC && timems < DAY) string += ` ${secs} s`;
  if (timems < MIN) string += ` ${remainder} ms`;
  return string;
}
