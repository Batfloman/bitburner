

export function appendToMap<K, T>(map: Map<K, T[]>, key: K, item: T): void {
  map.set(
    key,
    (map.get(key) ?? []).concat(item)
  )
}
