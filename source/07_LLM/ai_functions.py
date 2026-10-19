
def get_category():
    return {
        '납세의무': {
            '납세의무': 3, '거주자': 3, '비거주자': 3, '납세의무자': 3, 
            '원천징수': 2, '원천징수의무자': 2, '공동사업자': 2, 
            '상속인': 2, '증여자': 2, '신탁재산': 2
        },

        '세율계산': {
            '세율': 3, '소득세': 3, '과세표준': 3, '산출세액': 3, '세액': 3,
            '결정세액': 2, '세액계산': 2, '기본세율': 2, '세율적용': 2,
            '누진세율': 2, '종합소득세': 2
        },

        '근로소득': {
            '근로소득': 3, '총급여': 3, '급여': 3, '연봉': 3, '임금': 3,
            '근로소득금액': 2, '총급여액': 2, '상여': 2, '수당': 2,
            '봉급': 2, '직장인': 2
        },

        '사업소득': {
            '사업소득': 3, '총수입금액': 3, '필요경비': 3,
            '사업자': 2, '사업소득금액': 2, '결손금': 2, '이월결손금': 2,
            '주택임대소득': 2, '공동사업': 2
        },

        '이자배당': {
            '이자소득': 3, '배당소득': 3, '예금이자': 2, '채권': 2,
            '의제배당': 2, '배당세액공제': 2, '분리과세이자소득': 2,
            '분리과세배당소득': 2
        },

        '양도소득': {
            '양도소득': 3, '자산양도': 2, '부동산양도': 2, '주식양도': 2,
            '양도차익': 2, '취득가액': 2, '양도가액': 2, '양도소득금액': 2
        },

        '연금소득': {
            '연금소득': 3, '연금계좌': 3, '연금저축': 3,
            '퇴직연금': 2, '공적연금': 2, '사적연금': 2, '연금보험': 2,
            '연금수령': 2
        },

        '기타소득': {
            '기타소득': 3, '가상자산': 3, '가상자산소득': 2,
            '상금': 2, '보상금': 2, '종교인소득': 2, '원고료': 2,
            '복권': 1, '당첨금': 1, '발명보상금': 1
        },

        '공제감면': {
            '공제': 3, '소득공제': 3, '세액공제': 3,
            '기본공제': 2, '인적공제': 2, '특별공제': 2, '추가공제': 2,
            '근로소득공제': 2, '연금소득공제': 2, '퇴직소득공제': 2,
            '연금계좌세액공제': 2, '감면': 2
        },

        '비과세': {
            '비과세': 3, '비과세소득': 3, '면제': 2, '세액감면': 2,
            '소득세면제': 2, '복무급여': 1, '실업급여': 1, 
            '출산휴가급여': 1, '장학금': 1
        },

        '신고납부': {
            '신고': 3, '확정신고': 3, '과세표준확정신고': 3, 
            '납부': 3, '중간예납': 2, '가산세': 2,
            '신고기한': 2, '납부기한': 2, '납세지': 2
        },

        '과세기간': {
            '과세기간': 3, '과세연도': 3, '사업연도': 2, 
            '과세기간종료일': 2
        },

        '과세방식': {
            '종합과세': 3, '분리과세': 3, '합산과세': 2, 
            '종합소득과세표준': 2, '분리과세소득': 2, 
            '금융투자소득': 2
        },

        '장부기장': {
            '장부': 3, '복식부기': 3, '간편장부': 2, '기장': 2,
            '장부기록': 2, '증명서류': 2, '기장세액공제': 2
        }
    }

def categorize_content(content, top_k=None):
    category_scores = {}
    """
    content의 카테고리를 분류 - 점수 기반으로 모든 카테고리를 점수순으로 list를 반환(top_k만큼)
        Parameters : 
        -content : 카테고리를 분류할 텍스트
        -top_k : 상위 몇개까지의 카테고리를 반환할지 정수나 None(None이면 모든 카테고리를 반환)
        Returns:
        - 카테고리 리스트(점수순) ex.{'장부기장':30,'과세방식':45}=>['과세방식','장부기장']
    """
    category_keywords = get_category()
    category_score = {}
    # 각 카테고리별 점수계산
    for category, weighted_keywords in category_keywords.items():
#         print(category)
        score = 0
        for keyword,weight in weighted_keywords.items():
            #print(keyword,weight)
            count = content.count(keyword)
            score += count*weight
        if score>0:
            category_scores[category] = score
#     print(category_scores)
    sorted_categories = sorted(category_scores.items(),key=lambda item:item[1],reverse=True)#내림차순
#     print(sorted_categories)
    all_categories = [category[0] for category in sorted_categories]
    # 매칭되는 카테고리가 없을 경우 ["기타"]를 반환
    if not all_categories:
        all_categories = ["기타"]
#     print(all_categories)
    if top_k is not None:
        return all_categories[:top_k]
    else:
        return all_categories

# documents에서 참조조항을 추출하는 함수

def extract_articles_from_docs(documents):
    """
    검색된 문서 documents에서 article 정보를 추출하여 리스트로 반환
    Args:
    - documents : retriever에서 반환된 Document 객체 리스트
    Returns:
        중복 제거된 조항 리스트를 문자로 바꿔서 반환 (ex. '소득세법 제4조, 제60조')
    """
    articles = []
    for doc in documents:
        # metadata에서 article 정보 추출
        article = doc.metadata.get('article', '조항없음')
        article = article.replace('「', '').replace('」', '')
        article_list = article.split(', ')
        articles.extend(article_list)
    # 중복 제거 및 정렬
    unique_article = list(set(articles))
    unique_article.sort(key=lambda x : int(x[:-1]))
    final_article = ['제'+article for article in unique_article if article!='조항없음']
    result = '소득세법 ' + ', '.join(final_article)
    return result
# 검색된 documents를 텍스트로 변환하는 함수
def format_documents(retrieved_docs):
    return "\n--\n".join([doc.page_content.replace('\n\n', ' ') for doc in retrieved_docs])