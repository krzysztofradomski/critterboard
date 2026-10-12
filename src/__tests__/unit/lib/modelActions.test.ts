import { describe, expect, it } from 'vitest';

import { chatModelActions, visionModelActions } from '@/lib/modelActions';

describe('chatModelActions', () => {
  it('offers unload and delete while the model is in memory', () => {
    expect(chatModelActions('ready')).toEqual(['unload', 'delete']);
  });
  it('offers load and delete when the file is on disk but unloaded', () => {
    expect(chatModelActions('ejected')).toEqual(['load', 'delete']);
  });
  it('offers download when there is no file, or after an error', () => {
    expect(chatModelActions('absent')).toEqual(['download']);
    expect(chatModelActions('error')).toEqual(['download', 'delete']);
  });
  it('lets a download or a load be cancelled by deleting', () => {
    expect(chatModelActions('downloading')).toEqual(['delete']);
    expect(chatModelActions('loading')).toEqual(['delete']);
  });
  it('offers nothing where chat cannot run or is still being checked', () => {
    expect(chatModelActions('unsupported')).toEqual([]);
    expect(chatModelActions('tooLittleRam')).toEqual([]);
    expect(chatModelActions('checking')).toEqual([]);
  });
});

describe('visionModelActions', () => {
  it('offers nothing for a pack that is not installed', () => {
    expect(visionModelActions({ installed: false, fileExists: false, loaded: false })).toEqual([]);
  });
  it('offers unload only while the model is in memory', () => {
    expect(visionModelActions({ installed: true, fileExists: true, loaded: true })).toEqual(['unload', 'deleteFile']);
    expect(visionModelActions({ installed: true, fileExists: true, loaded: false })).toEqual(['deleteFile']);
  });
  it('offers download when the model file is gone', () => {
    expect(visionModelActions({ installed: true, fileExists: false, loaded: false })).toEqual(['download']);
  });
});
