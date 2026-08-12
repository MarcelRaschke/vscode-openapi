import { skipToken } from "@reduxjs/toolkit/query/react";
import React, { useEffect } from "react";
import styled from "styled-components";

import { ApiEntry, TagData } from "@xliic/common/tags";
import { ThemeColorVariables } from "@xliic/common/theme";

import { ErrorBanner } from "../../components/Banner";
import {
  ApiResponseEntry,
  CollectionSearchResult,
  refreshOptions,
  ResponseEntry,
  TagResponseEntry,
  useGetApisFromCollectionQuery,
  useGetCollectionQuery,
  useSearchCollectionsQuery,
} from "../../features/http-client/platform-api";
import { Tags, TrashCan } from "../../icons";
import { CollectionOrApiSearchSelector } from "./CollectionOrApiSearchSelector";
import { SelectOption } from "./SearchSelector";
import { saveTags, saveTagsInStateOnly } from "./slice";
import { useAppDispatch } from "./store";
import { useDebounce } from "./useDebounce";

type SelectOptionState = SelectOption<ResponseEntry> | undefined;

// how long to wait for the user to stop typing before searching for collections
const SEARCH_DELAY = 300;

export function ApiPanel({
  targetFileName,
  tagData,
}: {
  targetFileName: string;
  tagData: TagData;
}) {
  const dispatch = useAppDispatch();
  const targetData = tagData[targetFileName];
  // Previously selected data from IDE
  const apiEntry: ApiEntry | undefined =
    targetData === null || Array.isArray(targetData) ? undefined : targetData;
  // Current manually selected options
  const [colOption, setColOption] = React.useState<SelectOptionState>(undefined);
  const [apiOption, setApiOption] = React.useState<SelectOptionState>(undefined);
  useEffect(() => {
    setColOption(undefined);
    setApiOption(undefined);
  }, [targetFileName]);
  const collectionId = colOption ? colOption.value.desc.id : apiEntry?.collectionId;
  return (
    <HeaderContainer>
      <CollectionSelectPanel
        apiEntry={apiEntry}
        selectedOption={colOption}
        onOptionRemoved={(): void => {
          setApiOption(undefined);
          setColOption(undefined);
          dispatch(saveTags({ [targetFileName]: null }));
        }}
        onOptionSelected={(option: SelectOption<ResponseEntry>): void => {
          setApiOption(undefined);
          setColOption(option);
          dispatch(saveTags({ [targetFileName]: null }));
        }}
      ></CollectionSelectPanel>

      {collectionId && (
        <ApiSelectPanel
          apiEntry={apiEntry}
          collectionId={collectionId}
          selectedOptionId={apiOption ? apiOption.id : apiEntry?.apiId}
          onOptionRemoved={(): void => {
            setApiOption(undefined);
            const tagData: TagData = {};
            tagData[targetFileName] = {
              apiId: "",
              apiName: "",
              collectionId: colOption?.value.desc.id || apiEntry?.collectionId,
              collectionName: colOption?.value.desc.name || apiEntry?.collectionName,
            } as ApiEntry;
            // Save in state, do not notify IDE
            dispatch(saveTagsInStateOnly(tagData));
          }}
          onOptionSelected={(option: SelectOption<ResponseEntry>): void => {
            setApiOption(option);
            const tagData: TagData = {};
            tagData[targetFileName] = {
              apiId: option.value.desc.id,
              apiName: option.value.desc.name,
              collectionId: colOption?.value.desc.id || apiEntry?.collectionId,
              collectionName: colOption?.value.desc.name || apiEntry?.collectionName,
            } as ApiEntry;
            dispatch(saveTags(tagData));
          }}
        ></ApiSelectPanel>
      )}
    </HeaderContainer>
  );
}

function CollectionSelectPanel({
  apiEntry,
  selectedOption,
  onOptionRemoved,
  onOptionSelected,
}: {
  apiEntry: ApiEntry | undefined;
  selectedOption: SelectOptionState;
  onOptionRemoved: () => void;
  onOptionSelected: (option: SelectOption<ResponseEntry>) => void;
}) {
  const [searchValue, setSearchValue] = React.useState("");
  const search = useDebounce(searchValue, SEARCH_DELAY);
  const { data, error, isFetching } = useSearchCollectionsQuery(search, refreshOptions);

  // keep displaying the previous search results while the new ones are being fetched
  const [lastResult, setLastResult] = React.useState<CollectionSearchResult | undefined>(undefined);
  useEffect(() => {
    if (data !== undefined) {
      setLastResult(data);
    }
  }, [data]);
  const result = data ?? lastResult;

  // the collection selected earlier in the IDE may be missing from the search results,
  // read it separately to display its current name and to check that it still exists
  const savedCollectionId = selectedOption === undefined ? apiEntry?.collectionId : undefined;
  const {
    data: savedCollection,
    error: savedCollectionError,
    isFetching: isSavedCollectionFetching,
  } = useGetCollectionQuery(savedCollectionId ? savedCollectionId : skipToken, refreshOptions);

  const options: SelectOption<ResponseEntry>[] = (result?.collections || [])
    // Do not suggest the option if it is already selected
    .filter((entry) => entry.desc.id !== selectedOption?.id)
    .map((entry) => ({
      id: entry.desc.id,
      value: entry,
      label: entry.desc.name,
    }));

  const requestError = error || savedCollectionError;
  const hasMore = result !== undefined && result.total > result.collections.length;

  return (
    <Container>
      <Header>
        <HeaderSpan>Collection</HeaderSpan>
        <SearchContainer>
          <CollectionOrApiSearchSelector
            type="collection"
            options={options}
            onItemSelected={onOptionSelected}
            onInputValueChanged={setSearchValue}
          />
          {isFetching && <SearchNoteSpan>Searching for collections...</SearchNoteSpan>}
          {!isFetching && hasMore && (
            <SearchNoteSpan>
              {`Showing ${result.collections.length} of ${result.total} matching collections, ` +
                `refine your search`}
            </SearchNoteSpan>
          )}
        </SearchContainer>
      </Header>
      {!requestError && selectedOption && (
        <HeaderOptionPanel
          id={selectedOption.value.desc.id}
          name={selectedOption.label}
          isLoaded={true}
          onOptionRemoved={onOptionRemoved}
        />
      )}
      {!requestError &&
        savedCollectionId &&
        !isSavedCollectionFetching &&
        (savedCollection ? (
          <HeaderOptionPanel
            id={savedCollection.desc.id}
            name={savedCollection.desc.name}
            isLoaded={true}
            onOptionRemoved={onOptionRemoved}
          />
        ) : (
          <HeaderOptionPanel
            id={savedCollectionId}
            name={apiEntry?.collectionName as string}
            error={"This collection is not found on the server"}
            isLoaded={false}
            onOptionRemoved={onOptionRemoved}
          />
        ))}
      <HeaderError>
        {requestError && (
          <ErrorBanner message={"Failed to load collections"}>
            HTTPError: Response code {requestError.code} ({requestError.message})
          </ErrorBanner>
        )}
      </HeaderError>
    </Container>
  );
}

function ApiSelectPanel({
  apiEntry,
  collectionId,
  selectedOptionId,
  onOptionRemoved,
  onOptionSelected,
}: {
  apiEntry: ApiEntry | undefined;
  collectionId: string;
  selectedOptionId: string | undefined;
  onOptionRemoved: () => void;
  onOptionSelected: (option: SelectOption<ResponseEntry>) => void;
}) {
  const { data, error, isLoading } = useGetApisFromCollectionQuery(collectionId, refreshOptions);
  let options: SelectOption<ResponseEntry>[] = [];
  if (data) {
    data.forEach((entry) =>
      options.push({
        id: entry.desc.id,
        value: entry,
        label: entry.desc.name,
      } as SelectOption<ResponseEntry>)
    );
  }
  const option = options?.filter((o) => o.id === selectedOptionId)[0];
  if (option) {
    // Do not suggest the option if it is already selected
    options = options?.filter((o) => o.id !== option.id);
  }
  return (
    <Container>
      <Header>
        {isLoading && <HeaderSpan>{"Loading APIs from the server..."}</HeaderSpan>}
        {!isLoading && <HeaderSpan>API</HeaderSpan>}
        {!isLoading && (
          <CollectionOrApiSearchSelector
            type="api"
            options={options}
            onItemSelected={onOptionSelected}
          />
        )}
      </Header>
      {!isLoading && !error && option && (
        <HeaderOptionPanel
          id={option.value.desc.id}
          name={option.label}
          tags={(option.value as ApiResponseEntry).tags}
          isLoaded={true}
          onOptionRemoved={onOptionRemoved}
        />
      )}
      {!isLoading && !error && !option && apiEntry && apiEntry.apiId && (
        <HeaderOptionPanel
          id={apiEntry.apiId}
          name={apiEntry.apiName}
          error={"This api is not found on the server"}
          isLoaded={false}
          onOptionRemoved={onOptionRemoved}
        />
      )}
      <HeaderError>
        {error && (
          <ErrorBanner message={"Failed to load APIs"}>
            HTTPError: Response code {error.code} ({error.message})
          </ErrorBanner>
        )}
      </HeaderError>
    </Container>
  );
}

function HeaderOptionPanel({
  id,
  name,
  error,
  tags,
  isLoaded,
  onOptionRemoved,
}: {
  id: string;
  name: string;
  error?: string;
  tags?: TagResponseEntry[];
  isLoaded: boolean;
  onOptionRemoved: () => void;
}) {
  return (
    <HeaderOptionContainer $isLoaded={isLoaded}>
      <HeaderOptionContainerInfo>
        <HeaderOptionSpan>{name}</HeaderOptionSpan>
        <HeaderOptionNoteSpan>UUID: {id}</HeaderOptionNoteSpan>
        {tags && (
          <HeaderOptionContainerTagInfo>
            {tags.length > 0 && <Tags />}
            {tags.map((tagItem: TagResponseEntry, tagItemIndex: number) => {
              return (
                <HeaderOptionTagSpan key={`api-tag-${tagItemIndex}`}>
                  {tagItem.categoryName}: {tagItem.tagName}
                </HeaderOptionTagSpan>
              );
            })}
          </HeaderOptionContainerTagInfo>
        )}
        {!isLoaded && <HeaderOptionErrorSpan>{error}</HeaderOptionErrorSpan>}
      </HeaderOptionContainerInfo>
      <HeaderOptionContainerAction>
        <HeaderOptionRemoverSpan
          onClick={(e) => {
            e.stopPropagation();
            onOptionRemoved();
          }}
        >
          <TrashCan />
        </HeaderOptionRemoverSpan>
      </HeaderOptionContainerAction>
    </HeaderOptionContainer>
  );
}

const Container = styled.div`
  gap: 5px;
  display: flex;
  flex-direction: column;
`;

export const Title = styled.div`
  font-weight: 700;
  margin-bottom: 16px;
`;

const HeaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
`;

const Header = styled.div`
  display: flex;
  flex-direction: row;
  gap: 20px;
  background-color: var(${ThemeColorVariables.computedOne});
  border-color: var(${ThemeColorVariables.border});
  border-width: 1px;
  border-style: solid;
  border-radius: 3px;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
`;

export const HeaderOptionContainer = styled.div<{ $isLoaded: boolean }>`
  display: flex;
  flex-direction: row;
  min-height: 50px;
  background-color: var(${ThemeColorVariables.computedOne});
  border-color: var(${ThemeColorVariables.border});
  border-width: 1px;
  border-style: solid;
  border-radius: 3px;
  ${({ $isLoaded }) =>
    !$isLoaded &&
    `
     border-color: var(${ThemeColorVariables.errorBorder});
  `}
`;

export const HeaderOptionContainerInfo = styled.div`
  display: flex;
  flex-direction: column;
  width: 97%;
  gap: 10px;
  padding: 16px;
`;

export const HeaderOptionContainerAction = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const SearchContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const SearchNoteSpan = styled.span`
  font-size: 90%;
  color: var(${ThemeColorVariables.disabledForeground});
`;

const HeaderError = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
`;

export const HeaderSpan = styled.span`
  font-weight: bold;
`;

export const HeaderOptionSpan = styled.span`
  font-weight: bold;
`;

export const HeaderOptionErrorSpan = styled.span`
  color: var(${ThemeColorVariables.errorForeground});
`;

export const HeaderOptionNoteSpan = styled.span`
  font-weight: smaller;
  color: var(${ThemeColorVariables.disabledForeground});
`;

export const HeaderOptionRemoverSpan = styled.span`
  font-weight: bold;
  cursor: pointer;
  padding: 16px;
  > svg {
    fill: var(${ThemeColorVariables.foreground});
  }
`;

const HeaderOptionContainerTagInfo = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  > svg {
    margin-left: 3px;
    fill: var(${ThemeColorVariables.foreground});
  }
`;

const HeaderOptionTagSpan = styled.div`
  border-color: var(${ThemeColorVariables.border});
  border-width: 1px;
  border-style: solid;
  border-radius: 5px;
  padding: 3px;
  font-size: 90%;
`;
