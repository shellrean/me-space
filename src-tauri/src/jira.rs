use serde::Serialize;

#[derive(Serialize)]
struct JiraSearchBody {
    jql: String,
    #[serde(rename = "maxResults")]
    max_results: u32,
    fields: Vec<String>,
}

#[tauri::command]
pub async fn jira_search_issues(
    site: String,
    email: String,
    api_token: String,
    jql: String,
) -> Result<serde_json::Value, String> {
    let url = format!("https://{site}/rest/api/3/search/jql");
    let client = reqwest::Client::new();

    let body = JiraSearchBody {
        jql,
        max_results: 50,
        fields: vec![
            "summary".into(),
            "status".into(),
            "issuetype".into(),
            "priority".into(),
            "project".into(),
            "updated".into(),
            "subtasks".into(),
            "assignee".into(),
        ],
    };

    let response = client
        .post(&url)
        .basic_auth(email, Some(api_token))
        .header("Accept", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Jira API error {status}: {text}"));
    }

    response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn jira_get_issue(
    site: String,
    email: String,
    api_token: String,
    issue_key: String,
) -> Result<serde_json::Value, String> {
    let url = format!(
        "https://{site}/rest/api/3/issue/{issue_key}?expand=renderedFields"
    );
    let client = reqwest::Client::new();

    let response = client
        .get(&url)
        .basic_auth(email, Some(api_token))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Jira API error {status}: {text}"));
    }

    response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())
}
