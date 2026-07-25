import { requireCurrentOrg } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, InlineAlert } from '@/components/ui';
import { ImportCsvForm } from './import-csv-form';

export const dynamic = 'force-dynamic';

export default async function ImportarImpressoesPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createClient();

  const { data: filaments } = await supabase
    .from('filaments')
    .select('name')
    .eq('organization_id', org.organizationId)
    .eq('active', true);

  return (
    <div>
      <PageHeader
        title="Importar impressões"
        subtitle="Suba um CSV com o histórico de impressões que você já fez"
      />

      <div className="mb-5">
        <InlineAlert tone="info">
          A Bambu Lab não oferece exportação oficial de histórico. Use nosso modelo de planilha — preencha com o
          que você já tem anotado (ou copie do Bambu Handy manualmente) e envie aqui.
        </InlineAlert>
      </div>

      <Card>
        <ImportCsvForm filamentNames={(filaments ?? []).map((f) => f.name)} />
      </Card>
    </div>
  );
}
