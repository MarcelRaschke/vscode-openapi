import { ThemeColorVariables } from "@xliic/common/theme";
import styled from "styled-components";
import {
  ApiResponseEntry,
  ResponseEntry,
  TagResponseEntry,
} from "../../features/http-client/platform-api";
import Tags from "../../icons/Tags";
import { SearchSelector, SearchSpan, SelectOption } from "./SearchSelector";

export function CollectionOrApiSearchSelector({
  type,
  options,
  onItemSelected,
  onInputValueChanged,
}: {
  type: "collection" | "api";
  options: SelectOption<ResponseEntry>[];
  onItemSelected: (item: SelectOption<ResponseEntry>) => void;
  // if set, the options are searched for on the server and are not filtered locally
  onInputValueChanged?: (inputValue: string) => void;
}) {
  return (
    <SearchSelector
      options={options}
      placeholder={(type === "collection" ? "Collection" : "API") + " name"}
      keepOpen={false}
      applyHoverCss={true}
      filter={(
        items: SelectOption<ResponseEntry>[],
        inputValue: string
      ): SelectOption<ResponseEntry>[] => {
        if (onInputValueChanged !== undefined) {
          return items;
        }
        const searchValue = inputValue.toLowerCase();
        return items.filter((item) => {
          return (
            item.value.desc.name.toLocaleLowerCase().includes(searchValue) ||
            item.value.desc.id.toLocaleLowerCase().includes(searchValue)
          );
        });
      }}
      renderer={(item: SelectOption<ResponseEntry>, index: number, inputValue: string) => {
        return (
          <>
            <SearchSpan value={item.label} searchValue={inputValue}></SearchSpan>
            <CategoryNoteSpan>
              <SearchSpan
                value={`UUID: ${item.value.desc.id}`}
                searchValue={inputValue}
              ></SearchSpan>
            </CategoryNoteSpan>

            {type === "api" && (item.value as ApiResponseEntry).tags.length > 0 && (
              <HeaderOptionContainerTagInfo>
                {(item.value as ApiResponseEntry).tags.length > 0 && <Tags />}
                {(item.value as ApiResponseEntry).tags.length > 0 && (
                  <HeaderOptionTagsCount>
                    {`${(item.value as ApiResponseEntry).tags.length} tags`}
                  </HeaderOptionTagsCount>
                )}
              </HeaderOptionContainerTagInfo>
            )}
          </>
        );
      }}
      onItemSelected={onItemSelected}
      onInputValueChanged={onInputValueChanged}
    />
  );
}

const CategoryNoteSpan = styled.span`
  font-weight: smaller;
  color: var(${ThemeColorVariables.disabledForeground});
`;

const HeaderOptionContainerTagInfo = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 5px;
  > svg {
    margin-left: 3px;
    fill: var(${ThemeColorVariables.foreground});
  }
`;

const HeaderOptionTagsCount = styled.div`
  font-size: 90%;
`;
