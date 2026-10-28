// node --test reporter that prints one JSON summary of leaf test results.
export default async function* jsonReporter(source) {
  const result = { tests: 0, pass: 0, fail: 0, skipped: 0, failures: [] };
  for await (const event of source) {
    if (event.type !== "test:pass" && event.type !== "test:fail") continue;
    if (event.data.details?.type === "suite") continue;
    result.tests++;
    if (event.data.skip || event.data.todo) result.skipped++;
    else if (event.type === "test:pass") result.pass++;
    else {
      result.fail++;
      result.failures.push({ name: event.data.name, file: event.data.file, error: String(event.data.details?.error?.cause ?? event.data.details?.error ?? "").slice(0, 500) });
    }
  }
  yield JSON.stringify(result, null, 2) + "\n";
}
