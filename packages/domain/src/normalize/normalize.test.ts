import { describe, expect, it } from 'vitest';
import { normalizeBambuTask, normalizeStatus } from './index.js';
import {
  cancelledTask,
  completedTask,
  emptyAmsTask,
  failedTask,
  invalidDatesTask,
  missingFieldsTask,
  msEpochTask,
  multiMaterialTask,
  printingTask,
  unknownStatusTask,
  zeroWeightZeroTimeTask,
} from '../fixtures/bambu-tasks.js';

describe('normalizeStatus', () => {
  it('mapeia rótulos conhecidos', () => {
    expect(normalizeStatus('success').status).toBe('completed');
    expect(normalizeStatus('running').status).toBe('printing');
    expect(normalizeStatus('canceled').status).toBe('cancelled');
    expect(normalizeStatus('failed').status).toBe('failed');
    expect(normalizeStatus('pending').status).toBe('pending');
  });

  it('desconhecido → unknown, matched false', () => {
    const r = normalizeStatus('foo_bar');
    expect(r.status).toBe('unknown');
    expect(r.matched).toBe(false);
  });
});

describe('normalizeBambuTask — impressão concluída', () => {
  const n = normalizeBambuTask(completedTask);

  it('extrai id, título e capa', () => {
    expect(n.externalTaskId).toBe('task-1001');
    expect(n.title).toBe('Suporte de fone');
    expect(n.coverUrl).toContain('cover1.png');
  });

  it('prefere end-start em vez de costTime para concluídos', () => {
    expect(n.durationSource).toBe('end_minus_start');
    expect(n.providerDurationS).toBe(7200); // 2h, não os 6800 de costTime
  });

  it('converte epoch em segundos para ISO UTC', () => {
    expect(n.providerStartAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it('extrai múltiplos materiais do AMS', () => {
    expect(n.materials).toHaveLength(2);
    expect(n.materials[0]).toMatchObject({ amsUnit: 0, slotNumber: 1, materialType: 'PLA' });
  });

  it('preserva o payload bruto', () => {
    expect(n.rawPayload).toBe(completedTask);
  });
});

describe('normalizeBambuTask — em andamento', () => {
  it('status printing e usa costTime (sem endTime)', () => {
    const n = normalizeBambuTask(printingTask);
    expect(n.normalizedStatus).toBe('printing');
    expect(n.durationSource).toBe('cost_time');
    expect(n.providerDurationS).toBe(3600);
    expect(n.providerEndAt).toBeNull();
  });
});

describe('normalizeBambuTask — cancelada e falhada', () => {
  it('cancelada', () => {
    expect(normalizeBambuTask(cancelledTask).normalizedStatus).toBe('cancelled');
  });
  it('falhada usa costTime (não é concluída, então não usa end-start)', () => {
    const n = normalizeBambuTask(failedTask);
    expect(n.normalizedStatus).toBe('failed');
    expect(n.durationSource).toBe('cost_time');
    expect(n.providerDurationS).toBe(900);
  });
});

describe('normalizeBambuTask — casos degenerados', () => {
  it('peso zero e tempo zero geram avisos e duração none', () => {
    const n = normalizeBambuTask(zeroWeightZeroTimeTask);
    expect(n.providerWeightG).toBe(0);
    expect(n.warnings).toContain('peso_zero');
    expect(n.warnings).toContain('duracao_zero');
    expect(n.durationSource).toBe('none');
    expect(n.providerDurationS).toBeNull();
  });

  it('campos ausentes não quebram; status unknown', () => {
    const n = normalizeBambuTask(missingFieldsTask);
    expect(n.externalTaskId).toBe('task-1006');
    expect(n.normalizedStatus).toBe('unknown');
    expect(n.providerStartAt).toBeNull();
    expect(n.providerWeightG).toBeNull();
    expect(n.materials).toEqual([]);
  });

  it('datas inválidas → null com aviso', () => {
    const n = normalizeBambuTask(invalidDatesTask);
    expect(n.providerStartAt).toBeNull();
    expect(n.providerEndAt).toBeNull();
    expect(n.warnings).toContain('start_time_invalido');
    // cai para costTime já que end-start não é possível
    expect(n.durationSource).toBe('cost_time');
    expect(n.providerDurationS).toBe(5400);
  });

  it('status desconhecido → unknown com aviso', () => {
    const n = normalizeBambuTask(unknownStatusTask);
    expect(n.normalizedStatus).toBe('unknown');
    expect(n.warnings).toContain('status_desconhecido');
  });

  it('AMS vazio gera aviso e lista vazia', () => {
    const n = normalizeBambuTask(emptyAmsTask);
    expect(n.materials).toEqual([]);
    expect(n.warnings).toContain('ams_mapping_vazio');
  });

  it('AMS com vários materiais em unidades diferentes', () => {
    const n = normalizeBambuTask(multiMaterialTask);
    expect(n.materials).toHaveLength(3);
    expect(n.materials[2]).toMatchObject({ amsUnit: 1, materialType: 'ABS' });
  });

  it('epoch em milissegundos é convertido corretamente', () => {
    const n = normalizeBambuTask(msEpochTask);
    expect(n.providerStartAt).toBe(new Date(1_700_800_000_000).toISOString());
  });

  it('payload não-objeto não quebra', () => {
    expect(() => normalizeBambuTask(null)).not.toThrow();
    expect(() => normalizeBambuTask('lixo')).not.toThrow();
    const n = normalizeBambuTask(null);
    expect(n.warnings).toContain('external_task_id_ausente');
  });
});
