/* @flow */

import NProgress from 'nprogress';

import api from 'core/api';

import { actions as entitiesActions } from 'core/entities';
import * as notification from 'core/notification';
import { actions as pluralActions } from 'core/plural';
import { actions as resourceActions } from 'core/resource';
import { actions as statsActions } from 'core/stats';
import * as unsavedchanges from 'modules/unsavedchanges';

import type { Entity } from 'core/api';
import type { Locale } from 'core/locale';
import type { FluentMessage } from 'core/utils/fluent/types';


export const END_UPDATE_TRANSLATION: 'editor/END_UPDATE_TRANSLATION' = 'editor/END_UPDATE_TRANSLATION';
export const RESET_FAILED_CHECKS: 'editor/RESET_FAILED_CHECKS' = 'editor/RESET_FAILED_CHECKS';
export const RESET_SELECTION: 'editor/RESET_SELECTION' = 'editor/RESET_SELECTION';
export const SET_INITIAL_TRANSLATION: 'editor/SET_INITIAL_TRANSLATION' = 'editor/SET_INITIAL_TRANSLATION';
export const START_UPDATE_TRANSLATION: 'editor/START_UPDATE_TRANSLATION' = 'editor/START_UPDATE_TRANSLATION';
export const UPDATE: 'editor/UPDATE' = 'editor/UPDATE';
export const UPDATE_FAILED_CHECKS: 'editor/UPDATE_FAILED_CHECKS' = 'editor/UPDATE_FAILED_CHECKS';
export const UPDATE_SELECTION: 'editor/UPDATE_SELECTION' = 'editor/UPDATE_SELECTION';


export type Translation = string | FluentMessage;

/**
 * Update the current translation of the selected entity.
 */
export type UpdateAction = {|
    +type: typeof UPDATE,
    +translation: Translation,
    +changeSource: string,
|};
export function update(translation: Translation, changeSource?: string): UpdateAction {
    return {
        type: UPDATE,
        translation,
        changeSource: changeSource || 'internal',
    };
}


/**
 * Update the content that should replace the currently selected text in the
 * active editor.
 */
export type UpdateSelectionAction = {|
    +type: typeof UPDATE_SELECTION,
    +content: string,
|};
export function updateSelection(content: string): UpdateSelectionAction {
    return {
        type: UPDATE_SELECTION,
        content,
    };
}


/**
 * Update the content that should replace the currently selected text in the
 * active editor.
 */
export type InitialTranslationAction = {|
    +type: typeof SET_INITIAL_TRANSLATION,
    +translation: Translation,
|};
export function setInitialTranslation(translation: Translation): InitialTranslationAction {
    return {
        type: SET_INITIAL_TRANSLATION,
        translation,
    };
}


/**
 * Update failed checks in the active editor.
 */
export type FailedChecks = {|
    +clErrors: Array<string>,
    +pErrors: Array<string>,
    +clWarnings: Array<string>,
    +pndbWarnings: Array<string>,
    +ttWarnings: Array<string>,
|};
export type UpdateFailedChecksAction = {|
    +type: typeof UPDATE_FAILED_CHECKS,
    +failedChecks: FailedChecks,
    +source: '' | 'stored' | 'submitted' | number,
|};
export function updateFailedChecks(
    failedChecks: FailedChecks,
    source: '' | 'stored' | 'submitted' | number,
): UpdateFailedChecksAction {
    return {
        type: UPDATE_FAILED_CHECKS,
        failedChecks,
        source,
    };
}


/**
 * Reset content to default value.
 */
export type ResetSelectionAction = {|
    +type: typeof RESET_SELECTION,
|};
export function resetSelection(): ResetSelectionAction {
    return {
        type: RESET_SELECTION,
    };
}


/**
 * Reset failed checks to default value.
 */
export type ResetFailedChecksAction = {|
    +type: typeof RESET_FAILED_CHECKS,
|};
export function resetFailedChecks(): ResetFailedChecksAction {
    return {
        type: RESET_FAILED_CHECKS,
    };
}


export type StartUpdateTranslationAction = {|
   +type: typeof START_UPDATE_TRANSLATION,
|};
function startUpdateTranslation(): StartUpdateTranslationAction {
    return {
        type: START_UPDATE_TRANSLATION,
    };
}


export type EndUpdateTranslationAction = {|
   +type: typeof END_UPDATE_TRANSLATION,
|};
function endUpdateTranslation(): EndUpdateTranslationAction {
    return {
        type: END_UPDATE_TRANSLATION,
    };
}


/**
 * Save the current translation.
 */
export function sendTranslation(
    entity: Entity,
    translation: string,
    locale: Locale,
    pluralForm: number,
    forceSuggestions: boolean,
    nextEntity: ?Entity,
    router: Object,
    resource: string,
    ignoreWarnings: ?boolean,
): Function {
    return async dispatch => {
        NProgress.start();
        dispatch(startUpdateTranslation());

        const content = await api.translation.create(
            entity.pk,
            translation,
            locale.code,
            pluralForm,
            entity.original,
            forceSuggestions,
            resource,
            ignoreWarnings,
        );

        if (content.failedChecks) {
            dispatch(updateFailedChecks(content.failedChecks, 'submitted'));
        }
        else if (content.same) {
            // The translation that was provided is the same as an existing
            // translation for that entity.
            dispatch(notification.actions.add(notification.messages.SAME_TRANSLATION));
        }
        else if (content.status) {
            // Notify the user of the change that happened.
            dispatch(notification.actions.add(notification.messages.TRANSLATION_SAVED));

            // Ignore existing unsavedchanges because they are saved now.
            dispatch(unsavedchanges.actions.ignore());

            dispatch(
                entitiesActions.updateEntityTranslation(
                    entity.pk,
                    pluralForm,
                    content.translation
                )
            );

            // Update stats in the filter panel and resource menu if possible.
            if (content.stats) {
                dispatch(statsActions.update(content.stats));
                dispatch(
                    resourceActions.update(
                        entity.path,
                        content.stats.approved,
                        content.stats.warnings,
                    )
                );
            }

            if (nextEntity) {
                // The change did work, we want to move on to the next Entity or pluralForm.
                pluralActions.moveToNextTranslation(
                    dispatch,
                    router,
                    entity.pk,
                    nextEntity.pk,
                    pluralForm,
                    locale,
                );
            }
        }

        dispatch(endUpdateTranslation());
        NProgress.done();
    }
}


export default {
    resetFailedChecks,
    resetSelection,
    sendTranslation,
    setInitialTranslation,
    update,
    updateFailedChecks,
    updateSelection,
};
