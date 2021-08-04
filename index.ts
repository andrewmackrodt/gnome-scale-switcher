#!./node_modules/.bin/ts-node-dev
/**
 * Based on https://askubuntu.com/a/1267328/170380
 */

import { GSettings } from './src/GSettings'
import dbus from 'dbus-next'

const sessionBus = dbus.sessionBus()

const fractionalModeSet: ModeSet = {
    width: 3840,
    height: 2160,
    refresh: 60,
    scale: 1.5,
}

const nonFractionalModeSet: ModeSet = {
    width: 1920,
    height: 1080,
    refresh: 120,
    scale: 1,
}

interface ModeSet {
    width: number
    height: number
    refresh: number
    scale: number
}

async function getDisplay(iface: dbus.ClientInterface) {
    const currentState = await iface.GetCurrentState()
    const [/* state */, connectedMonitors, logicalMonitors] = currentState
    const logical = logicalMonitors.find((monitor: any) => monitor[4] === true)

    if ( ! logical) {
        throw new Error('Could not determine primary monitor')
    }

    const [
        /* x */,
        /* y */,
        /* scale */,
        /* transform */,
        /* primary */,
        monitors,
    ] = logical

    const connector = monitors[0][0]
    const connected = connectedMonitors.find((monitor: any) => monitor[0][0] === connector)

    if ( ! connected) {
        throw new Error('Could not determine connected monitor')
    }

    return {
        currentState,
        logical,
        connector,
        connected,
    }
}

function getModeAlias(connected: any, modeSet: ModeSet): string {
    const { width, height, refresh } = modeSet
    const mode = connected[1]
        .filter(m => m[1] === width && m[2] === height && (m[3] >= (refresh - 1) && m[3] <= refresh))
        .sort((a, b) => b[3] - a[3])[0]

    if ( ! mode) {
        throw new Error(`Unsupported mode ${width}x${height}@${refresh}`)
    }

    return mode[0]
}

async function main() {
    const mutter = new GSettings().schema('org.gnome.mutter')
    const featuresText = await mutter.get('experimental-features')
    const featuresJson: string[] = JSON.parse(featuresText.replace(/'/g, '"'))
    const fractionalScalingKey = 'x11-randr-fractional-scaling'

    let modeSet: ModeSet

    if ( ! featuresJson.includes(fractionalScalingKey)) {
        console.log('Enabling Mutter Experimental Feature:', fractionalScalingKey)
        const value = JSON.stringify(featuresJson.concat(fractionalScalingKey)).replace(/"/g, '\'')
        await mutter.set('experimental-features', value)
        modeSet = fractionalModeSet
    } else {
        console.log('Disabling Mutter Experimental Feature:', fractionalScalingKey)
        const value = JSON.stringify(featuresJson.filter(v => v !== fractionalScalingKey)).replace(/"/g, '\'')
        await mutter.set('experimental-features', value)
        modeSet = nonFractionalModeSet
    }

    const namespace = 'org.gnome.Mutter.DisplayConfig'
    const path = '/org/gnome/Mutter/DisplayConfig'
    const proxyObject = await sessionBus.getProxyObject(namespace, path)
    const iface = proxyObject.getInterface(namespace)
    const display = await getDisplay(iface)
    const modeAlias = getModeAlias(display.connected, modeSet)

    const config = [
        [
            display.logical[0],
            display.logical[1],
            modeSet.scale,
            display.logical[3],
            display.logical[4],
            [
                [
                    display.connector,
                    modeAlias,
                    {},
                ],
            ],
        ],
    ]

    console.log('Applying Config:', JSON.stringify(config))

    await iface.ApplyMonitorsConfig(display.currentState[0], 1, config, {})
}

main().finally(() => {
    sessionBus.disconnect()
})
