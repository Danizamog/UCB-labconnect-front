/**
 * Script para testear la suscripción realtime de PocketBase
 * Uso: Importar y ejecutar en la consola del navegador o en useEffect
 */

import PocketBase from 'pocketbase'

export async function testRealtimeSubscription() {
  const pbUrl = import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090'
  console.log('[DEBUG] Testando realtime con URL:', pbUrl)

  const pb = new PocketBase(pbUrl)

  try {
    // Test 1: Conectar a lab_reservation
    console.log('[TEST 1] Suscribiendo a lab_reservation...')
    const unsub1 = await pb.collection('lab_reservation').subscribe('*', (e) => {
      console.log('[TEST 1] ✓ lab_reservation event:', {
        action: e.action,
        id: e.record?.id,
        status: e.record?.status,
        laboratory_id: e.record?.laboratory_id,
      })
    })
    console.log('[TEST 1] ✓ Suscripción exitosa')

    // Test 2: Conectar a lab_block
    console.log('[TEST 2] Suscribiendo a lab_block...')
    const unsub2 = await pb.collection('lab_block').subscribe('*', (e) => {
      console.log('[TEST 2] ✓ lab_block event:', {
        action: e.action,
        id: e.record?.id,
      })
    })
    console.log('[TEST 2] ✓ Suscripción exitosa')

    // Test 3: Conectar a user_penalty
    console.log('[TEST 3] Suscribiendo a user_penalty...')
    const unsub3 = await pb.collection('user_penalty').subscribe('*', (e) => {
      console.log('[TEST 3] ✓ user_penalty event:', {
        action: e.action,
        id: e.record?.id,
        user_id: e.record?.user_id,
      })
    })
    console.log('[TEST 3] ✓ Suscripción exitosa')

    // Test 4: Conectar a notification
    console.log('[TEST 4] Suscribiendo a notification...')
    const unsub4 = await pb.collection('notification').subscribe('*', (e) => {
      console.log('[TEST 4] ✓ notification event:', {
        action: e.action,
        id: e.record?.id,
        recipient_user_id: e.record?.recipient_user_id,
      })
    })
    console.log('[TEST 4] ✓ Suscripción exitosa')

    console.log('[DEBUG] ✓✓✓ TODAS LAS SUSCRIPCIONES FUNCIONAN ✓✓✓')
    console.log('[DEBUG] Espera eventos... (cambios en las colecciones aparecerán aquí)')

    return {
      unsub1,
      unsub2,
      unsub3,
      unsub4,
      cleanup: () => {
        console.log('[DEBUG] Limpiando suscripciones...')
        unsub1?.()
        unsub2?.()
        unsub3?.()
        unsub4?.()
        console.log('[DEBUG] ✓ Suscripciones limpias')
      },
    }
  } catch (err) {
    console.error('[DEBUG] ✗ Error en suscripción:', err)
    throw err
  }
}

// Para usar en la consola del navegador:
// import { testRealtimeSubscription } from './debug/testRealtimeSubscription'
// const test = await testRealtimeSubscription()
// Cuando termines: test.cleanup()
