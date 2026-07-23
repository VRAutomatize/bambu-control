/**
 * Fixtures de tarefas Bambu para testes de normalização e sincronização.
 * Baseadas na estrutura documentada pela comunidade (engenharia reversa).
 * NÃO são um contrato oficial — servem para exercitar a normalização defensiva.
 */

export const completedTask = {
  id: 'task-1001',
  designId: 'model-55',
  title: 'Suporte de fone',
  cover: 'https://example.invalid/cover1.png',
  status: 'success',
  startTime: 1_700_000_000, // epoch em segundos
  endTime: 1_700_007_200, // +2h
  weight: 25.5,
  costTime: 6800, // menor que end-start; deve ser ignorado para concluídos
  deviceId: 'DEV-AABBCC',
  deviceName: 'X1C-Oficina',
  deviceModel: 'X1 Carbon',
  mode: 'cloud',
  amsDetailMapping: [
    { ams: 0, slot: 1, color: '#00A651', type: 'PLA', weight: 20 },
    { ams: 0, slot: 2, color: '#111111', type: 'PLA', weight: 5.5 },
  ],
};

export const printingTask = {
  id: 'task-1002',
  title: 'Vaso espiral',
  status: 'running',
  startTime: 1_700_100_000,
  costTime: 3600,
  weight: 40,
  deviceId: 'DEV-AABBCC',
  amsDetailMapping: [{ ams: 0, slot: 1, color: '#3366FF', type: 'PETG', weight: 40 }],
};

export const cancelledTask = {
  id: 'task-1003',
  title: 'Peça cancelada',
  status: 'canceled',
  startTime: 1_700_200_000,
  endTime: 1_700_200_600,
  costTime: 600,
  weight: 3,
  deviceId: 'DEV-AABBCC',
};

export const failedTask = {
  id: 'task-1004',
  title: 'Falha de adesão',
  status: 'failed',
  startTime: 1_700_300_000,
  endTime: 1_700_300_900,
  costTime: 900,
  weight: 8,
  deviceId: 'DEV-AABBCC',
};

export const zeroWeightZeroTimeTask = {
  id: 'task-1005',
  title: 'Sem dados físicos',
  status: 'success',
  startTime: 1_700_400_000,
  endTime: 1_700_400_000, // igual ao start → end-start inválido
  weight: 0,
  costTime: 0,
  deviceId: 'DEV-AABBCC',
};

export const missingFieldsTask = {
  id: 'task-1006',
  // sem status, sem datas, sem peso, sem AMS
};

export const invalidDatesTask = {
  id: 'task-1007',
  status: 'success',
  startTime: 'not-a-date',
  endTime: 'also-not-a-date',
  costTime: 5400,
  weight: 12,
};

export const unknownStatusTask = {
  id: 'task-1008',
  status: 'some_new_unmapped_state',
  startTime: 1_700_500_000,
  costTime: 1200,
  weight: 15,
};

export const emptyAmsTask = {
  id: 'task-1009',
  status: 'success',
  startTime: 1_700_600_000,
  endTime: 1_700_603_600,
  weight: 10,
  amsDetailMapping: [],
};

export const multiMaterialTask = {
  id: 'task-1010',
  status: 'success',
  startTime: 1_700_700_000,
  endTime: 1_700_710_800, // 3h
  weight: 120,
  amsDetailMapping: [
    { ams: 0, slot: 1, color: '#FF0000', type: 'PLA', weight: 50 },
    { ams: 0, slot: 2, color: '#00FF00', type: 'PLA', weight: 40 },
    { ams: 1, slot: 1, color: '#0000FF', type: 'ABS', weight: 30 },
  ],
};

export const msEpochTask = {
  id: 'task-1011',
  status: 'success',
  startTime: 1_700_800_000_000, // milissegundos
  endTime: 1_700_803_600_000,
  weight: 18,
};

/** Página de histórico para testes de sincronização/paginação. */
export const historyPage1 = {
  total: 12,
  hits: [completedTask, printingTask, cancelledTask, failedTask, multiMaterialTask],
};

export const allTasks = [
  completedTask,
  printingTask,
  cancelledTask,
  failedTask,
  zeroWeightZeroTimeTask,
  missingFieldsTask,
  invalidDatesTask,
  unknownStatusTask,
  emptyAmsTask,
  multiMaterialTask,
  msEpochTask,
];
