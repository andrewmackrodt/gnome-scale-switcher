#!./node_modules/.bin/ts-node-dev
/**
 * Based on https://askubuntu.com/a/1267328/170380
 */

import { GSettings } from './src/GSettings'
import dbus from 'dbus-next'

const sessionBus = dbus.sessionBus()

const main = async () => {
    const namespace = 'org.gnome.Mutter.DisplayConfig'
    const path = '/org/gnome/Mutter/DisplayConfig'
    const proxyObject = await sessionBus.getProxyObject(namespace, path)
    const clientInterface = proxyObject.getInterface(namespace)
    let currentState = await clientInterface.GetCurrentState()
    const [/* state */, connectedMonitors, logicalMonitors] = currentState
    const logicalMonitor = logicalMonitors.find((monitor: any) => monitor[4] === true)

    if ( ! logicalMonitor) {
        throw new Error('Could not determine primary monitor')
    }

    let [x, y, scale, transform, primary, monitors] = logicalMonitor

    const connector = monitors[0][0]
    const connectedMonitor = connectedMonitors.find((monitor: any) => monitor[0][0] === connector)

    if ( ! connectedMonitor) {
        throw new Error('Could not determine connected monitor')
    }

    let currentMode: string | undefined

    const displayModes = connectedMonitor[1]
    for (const mode of displayModes) {
        if (mode[6]['is-current']?.value) {
            currentMode = mode[0]
            break
        }
    }

    if ( ! currentMode) {
        throw new Error('Could not determine current display mode')
    }

    const mutter = new GSettings().schema('org.gnome.mutter')
    const featuresText = await mutter.get('experimental-features')
    const featuresJson: string[] = JSON.parse(featuresText.replace(/'/g, '"'))

    const fractionalScalingKey = 'x11-randr-fractional-scaling'

    if ( ! featuresJson.includes(fractionalScalingKey)) {
        console.log('Enabling Mutter Experimental Feature:', fractionalScalingKey)
        const value = JSON.stringify(featuresJson.concat(fractionalScalingKey)).replace(/"/g, '\'')
        await mutter.set('experimental-features', value)
        scale = 1.25
    } else {
        console.log('Disabling Mutter Experimental Feature:', fractionalScalingKey)
        const value = JSON.stringify(featuresJson.filter(v => v !== fractionalScalingKey)).replace(/"/g, '\'')
        await mutter.set('experimental-features', value)
        scale = 1
    }

    const config = [[x, y, scale, transform, primary, [[connector, currentMode, {}]]]]
    console.log('Applying Config:', JSON.stringify(config))

    // refresh current state as changing experimental-features invalidates previous serial
    currentState = await clientInterface.GetCurrentState()
    const serial = currentState[0]

    await clientInterface.ApplyMonitorsConfig(serial, 1, config, {})
}

main().finally(() => {
    sessionBus.disconnect()
})
