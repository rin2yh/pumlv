export function Preview({ svg }: { svg: string }) {
  return (
    <div className="flex h-full items-center justify-center overflow-auto">
      <img src={svg} alt="preview" />
    </div>
  );
}
