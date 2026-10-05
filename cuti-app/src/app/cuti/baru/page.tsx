import { Form } from "./Form";

export default async function BaruPage({ searchParams }: { searchParams: Promise<{ jenis?: string }> }) {
  const { jenis } = await searchParams;
  return <Form jenisAwal={jenis} />;
}
