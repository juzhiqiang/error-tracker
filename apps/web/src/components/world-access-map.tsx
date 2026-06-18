'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts/core'
import { MapChart, ScatterChart } from 'echarts/charts'
import {
  GeoComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { feature } from 'topojson-client'
import worldAtlas from 'world-atlas/countries-110m.json'
import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { GeoDistributionPoint } from '@/lib/api'
import { compactNumber, toNumber } from '@/lib/format'

echarts.use([MapChart, ScatterChart, GeoComponent, TooltipComponent, VisualMapComponent, CanvasRenderer])

const WORLD_MAP_NAME = 'error-tracker-world-lite'

const isoNumericByAlpha2: Record<string, string> = {
  AU: '036',
  BR: '076',
  CA: '124',
  CN: '156',
  DE: '276',
  FR: '250',
  GB: '826',
  IN: '356',
  JP: '392',
  KR: '410',
  SG: '702',
  US: '840',
}

const countryCenters: Record<string, [number, number]> = {
  US: [-98, 39],
  CN: [104, 35],
  JP: [138, 37],
  KR: [127.5, 36],
  SG: [103.8, 1.35],
  IN: [78, 22],
  GB: [-2, 54],
  DE: [10, 51],
  FR: [2, 46],
  BR: [-52, -10],
  CA: [-106, 57],
  AU: [134, -25],
}

let registered = false

export function WorldAccessMap({
  data,
  emptyText,
  totalLabel,
}: {
  data: GeoDistributionPoint[]
  emptyText: string
  totalLabel: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const ranked = useMemo(
    () => [...data].sort((a, b) => toNumber(b.count) - toNumber(a.count)).slice(0, 6),
    [data],
  )
  const totalVisits = useMemo(() => data.reduce((sum, item) => sum + toNumber(item.count), 0), [data])

  useEffect(() => {
    if (!ref.current) return
    registerWorldMap()
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    const max = Math.max(1, ...data.map((item) => toNumber(item.count)))
    const mapData = data.map((item) => ({
      name: isoNumericByAlpha2[item.countryCode] ?? item.countryCode,
      value: toNumber(item.count),
      countryName: item.countryName,
    }))
    const scatterData = data
      .map((item) => {
        const center = countryCenters[item.countryCode]
        if (!center) return null
        return {
          name: item.countryName,
          value: [...center, toNumber(item.count)],
        }
      })
      .filter(Boolean)

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0b1220',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#e5edf7', fontFamily: 'Inter, sans-serif' },
        formatter: (params: unknown) => {
          const item = params as { data?: { countryName?: string; value?: number | unknown[] }; name?: string; value?: number | unknown[] }
          const rawValue = Array.isArray(item.value) ? item.value[2] : item.value
          const value = typeof rawValue === 'number' ? rawValue : toNumber(item.data?.value as number)
          return `${item.data?.countryName ?? item.name}<br/>Visits: ${compactNumber(value)}`
        },
      },
      visualMap: {
        show: false,
        min: 0,
        max,
        inRange: {
          color: ['#1e293b', '#4f46e5', '#22c55e'],
        },
      },
      geo: {
        map: WORLD_MAP_NAME,
        roam: false,
        silent: true,
        left: 0,
        right: 0,
        top: 8,
        bottom: 8,
        itemStyle: {
          areaColor: '#172033',
          borderColor: '#334155',
          borderWidth: 0.8,
        },
        emphasis: {
          disabled: true,
        },
      },
      series: [
        {
          type: 'map',
          map: WORLD_MAP_NAME,
          geoIndex: 0,
          data: mapData,
          itemStyle: {
            borderColor: '#475569',
            borderWidth: 0.8,
          },
          emphasis: {
            itemStyle: {
              areaColor: '#6366f1',
            },
            label: { show: false },
          },
        },
        {
          type: 'scatter',
          coordinateSystem: 'geo',
          data: scatterData,
          symbolSize: (value: unknown) => {
            const count = Array.isArray(value) ? toNumber(value[2] as number) : 0
            return Math.max(8, Math.min(28, 8 + (count / max) * 20))
          },
          itemStyle: {
            color: '#22c55e',
            shadowBlur: 14,
            shadowColor: 'rgba(34, 197, 94, 0.45)',
          },
        },
      ],
    })

    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(ref.current)
    return () => {
      observer.disconnect()
      chart.dispose()
    }
  }, [data])

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="app-panel-muted min-h-[320px] overflow-hidden p-2">
        {data.length > 0 ? (
          <div ref={ref} className="h-[316px] w-full" />
        ) : (
          <div className="flex h-[316px] items-center justify-center px-6 text-center text-sm leading-6 text-slate-500">
            {emptyText}
          </div>
        )}
      </div>
      <div className="space-y-2">
        {ranked.length > 0 && (
          <div className="app-panel-muted px-3 py-3">
            <div className="text-xs text-slate-500">{totalLabel}</div>
            <div className="mt-1 font-mono text-2xl text-slate-100">{compactNumber(totalVisits)}</div>
          </div>
        )}
        {ranked.length > 0 ? (
          ranked.map((item, index) => (
            <div key={`${item.countryCode}-${index}`} className="app-panel-muted flex min-h-[48px] items-center justify-between gap-3 px-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-200">{item.countryName}</div>
                <div className="font-mono text-xs text-slate-500">{item.countryCode}</div>
              </div>
              <div className="font-mono text-sm text-emerald-300">{compactNumber(item.count)}</div>
            </div>
          ))
        ) : (
          <div className="app-panel-muted p-4 text-sm leading-6 text-slate-500">{emptyText}</div>
        )}
      </div>
    </div>
  )
}

function registerWorldMap(): void {
  if (registered) return
  const topology = worldAtlas as unknown as Topology<{ countries: GeometryCollection<GeoJsonProperties> }>
  const countriesObject = topology.objects.countries as GeometryCollection<GeoJsonProperties>
  const countries = feature(topology, countriesObject) as FeatureCollection<Geometry, GeoJsonProperties>
  echarts.registerMap(WORLD_MAP_NAME, countries as never)
  registered = true
}
