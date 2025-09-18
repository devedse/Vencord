/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { ScreenshareIcon } from "@components/Icons";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Channel, User } from "@vencord/discord-types";
import { Menu, PopoutActions } from "@webpack/common";
import { React } from "@webpack/common";

import { ApplicationStreamingStore, ApplicationStreamPreviewStore } from "./webpack/stores";
import { ApplicationStream, Stream } from "./webpack/types/stores";

export interface UserContextProps {
    channel: Channel,
    channelSelected: boolean,
    className: string,
    config: { context: string; };
    context: string,
    onHeightUpdate: Function,
    position: string,
    target: HTMLElement,
    theme: string,
    user: User;
}

export interface StreamContextProps {
    appContext: string,
    className: string,
    config: { context: string; };
    context: string,
    exitFullscreen: Function,
    onHeightUpdate: Function,
    position: string,
    target: HTMLElement,
    stream: Stream,
    theme: string,
}

// Store opened stream windows to avoid duplicates
const openStreamWindows = new Set<string>();

const createStreamKey = (stream: ApplicationStream | Stream) => {
    return `stream-${stream.guildId || 'dm'}-${stream.channelId}-${stream.ownerId}`;
};

export const handleOpenStreamInNewWindow = async (stream: ApplicationStream | Stream) => {
    const streamKey = createStreamKey(stream);
    
    // Don't open duplicate windows for the same stream
    if (openStreamWindows.has(streamKey)) {
        return;
    }
    
    openStreamWindows.add(streamKey);
    
    // Get the stream preview URL
    const previewUrl = await ApplicationStreamPreviewStore.getPreviewURL(stream.guildId, stream.channelId, stream.ownerId);
    
    // Create a stream display component
    const StreamWindow = () => {
        React.useEffect(() => {
            return () => {
                openStreamWindows.delete(streamKey);
            };
        }, []);
        
        return React.createElement("div", {
            style: {
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#36393f",
                color: "#dcddde"
            }
        }, 
            React.createElement("div", {
                style: {
                    padding: "10px",
                    borderBottom: "1px solid #4f545c",
                    fontSize: "16px",
                    fontWeight: "bold"
                }
            }, `Stream from User ${stream.ownerId}`),
            previewUrl 
                ? React.createElement("img", {
                    src: previewUrl,
                    style: {
                        width: "100%",
                        height: "calc(100% - 50px)",
                        objectFit: "contain"
                    },
                    alt: "Stream preview"
                })
                : React.createElement("div", {
                    style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "calc(100% - 50px)",
                        fontSize: "18px"
                    }
                }, "Loading stream...")
        );
    };
    
    PopoutActions.open(streamKey, () => React.createElement(StreamWindow), {
        width: 1280,
        height: 720,
        resizable: true
    });
};

export const addStreamWindowContext: NavContextMenuPatchCallback = (children, { userId }: { userId: string | bigint; }) => {
    const stream = ApplicationStreamingStore.getAnyStreamForUser(userId);
    if (!stream) return;

    const streamWindowItem = (
        <Menu.MenuItem
            label="Open in New Window"
            id="open-stream-new-window"
            icon={ScreenshareIcon}
            action={() => stream && handleOpenStreamInNewWindow(stream)}
            disabled={!stream}
        />
    );

    children.push(<Menu.MenuSeparator />, streamWindowItem);
};

export const streamContextPatch: NavContextMenuPatchCallback = (children, { stream }: StreamContextProps) => {
    return addStreamWindowContext(children, { userId: stream.ownerId });
};

export const userContextPatch: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => {
    if (user) return addStreamWindowContext(children, { userId: user.id });
};

export default definePlugin({
    name: "SeparateStreamWindows",
    description: "Open each stream in a separate window instead of sharing the same popup",
    authors: [Devs.Ven],
    contextMenus: {
        "user-context": userContextPatch,
        "stream-context": streamContextPatch
    }
});